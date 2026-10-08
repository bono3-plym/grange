defmodule Grange.FarmStore do
  @moduledoc """
  Owns every player's field and barn inventory, plus the lobby listings.

  One GenServer holds all farms, so every mutation is serialized. State is
  in-memory only and lost on restart. Each successful change broadcasts the
  affected farm and the lobby summaries over PubSub.
  """

  use GenServer

  alias Grange.Farm

  @lobby_topic "lobby"

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @spec ensure(String.t()) :: map()
  def ensure(owner), do: GenServer.call(__MODULE__, {:ensure, owner})

  @spec has_farm?(String.t()) :: boolean()
  def has_farm?(owner), do: GenServer.call(__MODULE__, {:has_farm?, owner})

  @spec view(String.t()) :: map() | nil
  def view(owner), do: GenServer.call(__MODULE__, {:view, owner})

  @spec summaries() :: [map()]
  def summaries, do: GenServer.call(__MODULE__, :summaries)

  @spec action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def action(owner, action), do: GenServer.call(__MODULE__, {:action, owner, action})

  @spec sell_tomatoes(String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def sell_tomatoes(owner, count), do: GenServer.call(__MODULE__, {:sell_tomatoes, owner, count})

  @spec tick(integer()) :: [String.t()]
  def tick(now \\ System.monotonic_time(:millisecond)),
    do: GenServer.call(__MODULE__, {:tick, now})

  @spec reset() :: :ok
  def reset, do: GenServer.call(__MODULE__, :reset)

  @impl true
  def init(_opts), do: {:ok, %{farms: %{}}}

  @impl true
  def handle_call({:ensure, owner}, _from, state) do
    if Map.has_key?(state.farms, owner) do
      {:reply, view_of(state, owner), state}
    else
      state = put_farm(state, owner, %{tiles: %{}, tomatoes: 0})
      broadcast_change(owner, state)
      {:reply, view_of(state, owner), state}
    end
  end

  def handle_call({:has_farm?, owner}, _from, state) do
    {:reply, Map.has_key?(state.farms, owner), state}
  end

  def handle_call({:view, owner}, _from, state) do
    {:reply, view_of(state, owner), state}
  end

  def handle_call(:summaries, _from, state) do
    {:reply, summaries_of(state), state}
  end

  def handle_call({:action, owner, action}, _from, state) do
    case normalize(action) do
      {:ok, kind, x, y} -> run(state, owner, kind, x, y)
      :error -> {:reply, {:error, "invalid action"}, state}
    end
  end

  def handle_call({:sell_tomatoes, owner, count}, _from, state)
      when is_integer(count) and count > 0 do
    do_sell_tomatoes(state, owner, count)
  end

  def handle_call({:sell_tomatoes, _owner, _count}, _from, state) do
    {:reply, {:error, "invalid count"}, state}
  end

  def handle_call({:tick, now}, _from, state) do
    {state, owners} = mark_ready(state, now)
    Enum.each(owners, &broadcast_farm(&1, state))
    if owners != [], do: broadcast_lobby(state)
    {:reply, owners, state}
  end

  def handle_call(:reset, _from, _state), do: {:reply, :ok, %{farms: %{}}}

  defp run(state, owner, kind, x, y) do
    if Farm.in_bounds?(x, y) do
      apply_kind(state, owner, kind, x, y)
    else
      {:reply, {:error, "out of bounds"}, state}
    end
  end

  defp apply_kind(state, owner, :till, x, y), do: till(state, owner, x, y)

  defp apply_kind(state, owner, kind, x, y) do
    case tile_at(state, owner, x, y) do
      nil -> {:reply, {:error, "no tilled tile here"}, state}
      tile -> transform(state, owner, tile, kind, x, y)
    end
  end

  defp till(state, owner, x, y) do
    case tile_at(state, owner, x, y) do
      nil ->
        tile = Farm.new_tile(x, y)
        state = put_tile(state, owner, tile)
        broadcast_change(owner, state)
        {:reply, {:ok, view_of(state, owner)}, state}

      _tile ->
        {:reply, {:error, "tile is already tilled"}, state}
    end
  end

  defp transform(state, owner, tile, :plant, _x, _y) do
    settle(state, owner, Farm.plant(tile, now_ms()))
  end

  defp transform(state, owner, tile, :water, _x, _y) do
    settle(state, owner, Farm.water(tile, now_ms()))
  end

  defp transform(state, owner, tile, :harvest, _x, _y) do
    case Farm.harvest(tile) do
      {:ok, tilled} ->
        state =
          state
          |> put_tile(owner, tilled)
          |> add_tomatoes(owner, Farm.harvest_yield())

        broadcast_change(owner, state)
        {:reply, {:ok, view_of(state, owner)}, state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  defp settle(state, owner, {:ok, tile}) do
    state = put_tile(state, owner, tile)
    broadcast_change(owner, state)
    {:reply, {:ok, view_of(state, owner)}, state}
  end

  defp settle(state, _owner, {:error, reason}), do: {:reply, {:error, reason}, state}

  defp mark_ready(state, now) do
    Enum.reduce(state.farms, {state, []}, fn {owner, farm}, {acc, owners} ->
      {tiles, changed} = mark_tiles(farm.tiles, now)

      if changed do
        {put_farm(acc, owner, %{farm | tiles: tiles}), [owner | owners]}
      else
        {acc, owners}
      end
    end)
  end

  defp mark_tiles(tiles, now) do
    {tiles, changed} =
      Enum.reduce(tiles, {tiles, false}, fn {key, tile}, {acc, changed} ->
        if Farm.ready?(tile, now) do
          {Map.put(acc, key, Farm.mark_ready(tile)), true}
        else
          {acc, changed}
        end
      end)

    {tiles, changed}
  end

  @kinds %{"till" => :till, "plant" => :plant, "water" => :water, "harvest" => :harvest}

  defp normalize(action) when is_map(action) do
    kind = Map.get(@kinds, to_string(fetch(action, "kind")))
    x = to_integer(fetch(action, "x"))
    y = to_integer(fetch(action, "y"))

    if kind && is_integer(x) && is_integer(y) do
      {:ok, kind, x, y}
    else
      :error
    end
  end

  defp normalize(_action), do: :error

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
  defp to_integer(value) when is_integer(value), do: value
  defp to_integer(value) when is_binary(value), do: safe_to_integer(value)
  defp to_integer(_value), do: nil

  defp safe_to_integer(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp tile_at(state, owner, x, y) do
    farm = Map.get(state.farms, owner, %{tiles: %{}})
    Map.get(farm.tiles, {x, y})
  end

  defp put_tile(state, owner, tile) do
    farm = Map.get(state.farms, owner, %{tiles: %{}, tomatoes: 0})
    tiles = Map.put(farm.tiles, {tile.x, tile.y}, tile)
    put_farm(state, owner, %{farm | tiles: tiles})
  end

  defp add_tomatoes(state, owner, count) do
    farm = Map.get(state.farms, owner)
    put_farm(state, owner, %{farm | tomatoes: farm.tomatoes + count})
  end

  defp do_sell_tomatoes(state, owner, count) do
    case Map.get(state.farms, owner) do
      %{tomatoes: tomatoes} = farm when tomatoes >= count ->
        state = put_farm(state, owner, %{farm | tomatoes: tomatoes - count})
        broadcast_change(owner, state)
        {:reply, {:ok, view_of(state, owner)}, state}

      %{} ->
        {:reply, {:error, "not enough tomatoes"}, state}

      nil ->
        {:reply, {:error, "farm not found"}, state}
    end
  end

  defp put_farm(state, owner, farm), do: %{state | farms: Map.put(state.farms, owner, farm)}

  defp view_of(state, owner) do
    case Map.get(state.farms, owner) do
      nil -> nil
      farm -> %{owner: owner, tiles: Map.values(farm.tiles), tomatoes: farm.tomatoes}
    end
  end

  defp summaries_of(state) do
    state.farms
    |> Enum.map(fn {owner, farm} -> summary(owner, farm) end)
    |> Enum.sort_by(& &1.owner)
  end

  defp summary(owner, farm) do
    counts = Enum.frequencies_by(farm.tiles, fn {_key, tile} -> tile.state end)

    %{
      owner: owner,
      tiles: map_size(farm.tiles),
      planted: Map.get(counts, :planted, 0),
      watered: Map.get(counts, :watered, 0),
      ready: Map.get(counts, :ready, 0),
      tomatoes: farm.tomatoes
    }
  end

  defp broadcast_change(owner, state) do
    broadcast_farm(owner, state)
    broadcast_lobby(state)
  end

  defp broadcast_farm(owner, state) do
    GrangeWeb.Endpoint.broadcast("farm:" <> owner, "farmUpdate", %{
      farm: view_of(state, owner)
    })
  end

  defp broadcast_lobby(state) do
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "farms", %{
      farms: summaries_of(state)
    })
  end

  defp now_ms, do: System.monotonic_time(:millisecond)
end
