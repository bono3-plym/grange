defmodule Grange.Brewing do
  @moduledoc """
  Brewery batches: insert ten standard crops, start a one-hour timer, and let
  the farm tick deposit the finished drink in the owner's barn.

  Only standard wheat, tomato, and lettuce are fermentable. Input is taken from
  the barn so the server remains the authority on produce; the finished item is
  added back to the barn and broadcast with the farm.
  """

  import Ecto.Query

  alias Grange.{Barn, Brewery, Crops, Repo}

  @batch_size 10
  @recipes %{
    "wheat" => {"beer", "Beer"},
    "tomato" => {"tomato_juice", "Tomato Juice"},
    "lettuce" => {"lettuce_juice", "Lettuce Juice"}
  }
  @allowed_message """
  The brewery only ferments 10 standard wheat, tomatoes, or lettuce. Rare mutant crops are too delicate for the mash tun.
  """

  @doc "How long a batch takes; e2e shortens this through `:brew_ms`."
  @spec brew_ms() :: pos_integer()
  def brew_ms, do: Application.get_env(:grange, :brew_ms, 3_600_000)

  @doc "Allowed input crop id -> `{output item, display name}`."
  @spec recipes() :: map()
  def recipes, do: @recipes

  @doc "The owner's brewery state, or nil when they have not built one."
  @spec status(String.t()) :: map() | nil
  def status(owner) do
    case Repo.get_by(Brewery, owner: owner, property: "brewery") do
      nil -> nil
      row -> view(row)
    end
  end

  @doc "Runs an insert/remove/start action for the owner."
  @spec action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def action(owner, action) when is_map(action) do
    case Repo.transaction(fn -> run(owner, action) end) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  def action(_owner, _action), do: {:error, "invalid brewery action"}

  @doc "Finishes every batch whose timer elapsed; returns the owners that changed."
  @spec finish_due(integer()) :: [String.t()]
  def finish_due(now) do
    from(b in Brewery,
      where: b.status == "brewing" and not is_nil(b.ready_at) and b.ready_at <= ^now
    )
    |> Repo.all()
    |> Enum.flat_map(&finish/1)
    |> Enum.uniq()
  end

  defp finish(row) do
    case Repo.transaction(fn -> finish_row(row) end) do
      {:ok, _result} -> [row.owner]
      {:error, _reason} -> []
    end
  end

  defp finish_row(row) do
    if row.output_item, do: Barn.add(row.owner, row.output_item, 1)

    row
    |> Ecto.Changeset.change(
      status: "idle",
      input_item: nil,
      input_count: 0,
      output_item: nil,
      started_at: nil,
      ready_at: nil,
      last_output: row.output_item,
      last_output_at: System.system_time(:millisecond)
    )
    |> Repo.update!()
  end

  defp run(owner, action) do
    case fetch(action, "kind") do
      "insert" -> insert(owner, fetch(action, "item"))
      "remove" -> remove(owner)
      "start" -> start(owner)
      _ -> Repo.rollback("invalid brewery action")
    end
  end

  defp insert(owner, item) do
    row = row!(owner)
    ensure_idle!(row)
    {output, _name} = recipe!(item)

    if Map.get(Barn.map(owner), item, 0) < @batch_size do
      Repo.rollback("you need 10 #{String.downcase(input_name(item))} in your barn")
    end

    :ok = Barn.sell(owner, item, @batch_size)

    row
    |> Ecto.Changeset.change(
      input_item: item,
      input_count: @batch_size,
      output_item: output
    )
    |> Repo.update!()

    result(owner)
  end

  defp remove(owner) do
    row = row!(owner)

    cond do
      row.status != "idle" ->
        Repo.rollback("the brewery is busy")

      is_nil(row.input_item) ->
        Repo.rollback("the brewery is empty")

      true ->
        Barn.add(owner, row.input_item, row.input_count)

        row
        |> Ecto.Changeset.change(input_item: nil, input_count: 0, output_item: nil)
        |> Repo.update!()

        result(owner)
    end
  end

  defp start(owner) do
    row = row!(owner)

    cond do
      row.status != "idle" ->
        Repo.rollback("the brewery is already brewing")

      is_nil(row.input_item) ->
        Repo.rollback("add 10 crops first")

      true ->
        now = System.system_time(:millisecond)

        row
        |> Ecto.Changeset.change(
          status: "brewing",
          started_at: now,
          ready_at: now + brew_ms()
        )
        |> Repo.update!()

        result(owner)
    end
  end

  defp row!(owner) do
    case Repo.get_by(Brewery, owner: owner, property: "brewery") do
      nil -> Repo.rollback("build a brewery first")
      row -> row
    end
  end

  defp ensure_idle!(row) do
    if row.status != "idle" or row.input_item do
      Repo.rollback("the brewery is busy")
    end
  end

  defp recipe!(item) do
    case Map.fetch(@recipes, item) do
      {:ok, recipe} -> recipe
      :error -> Repo.rollback(String.trim(@allowed_message))
    end
  end

  defp input_name(item) do
    case Crops.get(item) do
      %{name: name} -> name
      _ -> item
    end
  end

  defp result(owner), do: %{brewery: status(owner), barn: Barn.map(owner)}

  defp view(row) do
    %{
      status: row.status,
      input_item: row.input_item,
      input_count: row.input_count,
      output_item: row.output_item,
      started_at: row.started_at,
      ready_at: row.ready_at,
      last_output: row.last_output,
      last_output_at: row.last_output_at
    }
  end

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
end
