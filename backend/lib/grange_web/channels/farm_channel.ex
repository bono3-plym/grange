defmodule GrangeWeb.FarmChannel do
  @moduledoc """
  A single farm's room: read-only for visitors, actions for the owner.

  Replaces the socket.io `visitFarm` / `leaveFarm` / `farmAction` events and
  the `farmUpdate` broadcast. Identity comes from the session, never the client.
  """

  use Phoenix.Channel

  alias Grange.FarmStore

  @impl true
  def join("farm:" <> owner, _payload, socket) do
    ensure_owner_farm(owner, socket)

    if FarmStore.has_farm?(owner) do
      GrangeWeb.Endpoint.subscribe("farm:" <> owner)
      {:ok, %{farm: FarmStore.view(owner)}, assign(socket, :owner, owner)}
    else
      {:error, %{error: "Farm not found"}}
    end
  end

  defp ensure_owner_farm(owner, socket) do
    case socket.assigns[:user] do
      %{username: ^owner} -> FarmStore.ensure(owner)
      _ -> nil
    end
  end

  @impl true
  def handle_in("farmAction", %{"action" => action}, socket) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username != owner -> {:reply, {:error, %{error: "not your farm"}}, socket}
      true -> act(socket, owner, action)
    end
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  defp act(socket, owner, action) do
    case FarmStore.action(owner, action) do
      {:ok, _farm} -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end
end
