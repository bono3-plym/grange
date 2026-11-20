defmodule GrangeWeb.RealtorController do
  @moduledoc "Real-estate listings and property construction for signed-in players."

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, FarmProps, FarmStore, Inventory, Realtor}

  @session_key :user_token

  def index(conn, _params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)

        json(conn, %{
          ok: true,
          catalog: Realtor.catalog(),
          owned: Realtor.owned(user.username),
          materials: Inventory.holdings(user.username),
          prop_inventory: FarmProps.inventory(user.username),
          balance: user.balance
        })
    end
  end

  def build(conn, params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)
        build(conn, user, Map.get(params, "property"))
    end
  end

  defp build(conn, user, property) do
    case Realtor.build(user, property) do
      {:ok, result} ->
        json(conn, Map.put(result, :ok, true))

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  defp unauthorized(conn) do
    conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end
end
