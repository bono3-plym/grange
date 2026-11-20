defmodule Grange.Realtor do
  @moduledoc """
  Real-estate catalogue and construction purchases.

  A property is built by spending both Grangecoin and building materials from
  the account's item ledger. The brewery is the first listing; ownership is
  persisted so it survives reloads and future features can hang off it.
  """

  import Ecto.Query

  alias Grange.{Brewery, FarmProps, FarmStore, Inventory, Repo, User}

  @properties %{
    "brewery" => %{
      id: "brewery",
      name: "Brewery",
      price: 5_000,
      materials: %{"wood-plank" => 20, "stone" => 20, "nails" => 100}
    }
  }

  @doc "Every property the realtor can build, keyed by id."
  @spec catalog() :: map()
  def catalog, do: @properties

  @doc "Property ids the owner has already built."
  @spec owned(String.t()) :: [String.t()]
  def owned(owner) do
    from(b in Brewery, where: b.owner == ^owner, order_by: b.inserted_at, select: b.property)
    |> Repo.all()
  end

  @doc "Builds `property` for the account, spending materials and Grangecoin."
  @spec build(User.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def build(%User{} = user, property) when is_binary(property) do
    case Map.fetch(@properties, property) do
      {:ok, spec} ->
        case purchase(user.id, user.username, property, spec) do
          {:ok, result} ->
            FarmStore.refresh(user.username)
            {:ok, result}

          {:error, reason} ->
            {:error, reason}
        end

      :error ->
        {:error, "unknown property"}
    end
  end

  def build(_user, _property), do: {:error, "invalid property"}

  defp purchase(user_id, owner, property, spec) do
    case Repo.transaction(fn -> purchase_txn(user_id, owner, property, spec) end) do
      {:ok, result} -> {:ok, result}
      {:error, :already_built} -> {:error, "already built"}
      {:error, :insufficient_funds} -> {:error, "insufficient funds"}
      {:error, {:missing_materials, items}} -> {:error, missing_message(items)}
      {:error, {:grant_failed, reason}} -> {:error, reason}
      {:error, _reason} -> {:error, "build failed"}
    end
  end

  defp purchase_txn(user_id, owner, property, spec) do
    user = Repo.get!(User, user_id)

    if Repo.exists?(from(b in Brewery, where: b.owner == ^owner and b.property == ^property)) do
      Repo.rollback(:already_built)
    end

    if user.balance < spec.price do
      Repo.rollback(:insufficient_funds)
    end

    spend_materials(owner, spec.materials)
    balance = user.balance - spec.price
    user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
    Repo.insert!(%Brewery{owner: owner, property: property})

    case FarmProps.grant(owner, property) do
      :ok -> :ok
      {:error, reason} -> Repo.rollback({:grant_failed, reason})
    end

    %{
      balance: balance,
      materials: Inventory.holdings(owner),
      owned: owned(owner),
      prop_inventory: FarmProps.inventory(owner)
    }
  end

  defp spend_materials(owner, materials) do
    held = Inventory.holdings(owner)

    missing =
      for {item, need} <- materials, Map.get(held, item, 0) < need, do: item

    if missing != [] do
      Repo.rollback({:missing_materials, missing})
    end

    Enum.each(materials, fn {item, need} ->
      case Inventory.take(owner, item, need) do
        :ok -> :ok
        {:error, _reason} -> Repo.rollback({:missing_materials, [item]})
      end
    end)
  end

  defp missing_message(items), do: "not enough materials: " <> Enum.join(items, ", ")
end
