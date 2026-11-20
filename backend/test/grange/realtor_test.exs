defmodule Grange.RealtorTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, FarmProps, FarmStore, Inventory, Realtor, Repo}

  setup do
    FarmStore.reset()
    Accounts.reset()
    :ok
  end

  defp user(username \\ "Buyer") do
    {:ok, user} =
      Accounts.register(%{
        "username" => username,
        "email" => "#{username}@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(username)
    user
  end

  defp stock(owner, planks \\ 20, stone \\ 20, nails \\ 100) do
    Inventory.add(owner, "wood-plank", planks)
    Inventory.add(owner, "stone", stone)
    Inventory.add(owner, "nails", nails)
  end

  defp fund(user, balance) do
    user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
  end

  test "building a brewery spends materials and coin and is persisted" do
    user = user()
    stock(user.username)
    funded = fund(user, 6_000)

    assert {:ok, result} = Realtor.build(funded, "brewery")
    assert result.balance == 1_000
    assert result.owned == ["brewery"]

    assert Map.take(result.materials, ["wood-plank", "stone", "nails"]) ==
             %{"wood-plank" => 0, "stone" => 0, "nails" => 0}

    assert result.prop_inventory["brewery"] == 1
    assert FarmProps.inventory(user.username)["brewery"] == 1
    assert Realtor.owned(user.username) == ["brewery"]
  end

  test "the brewery is a placeable prop that can be moved only by its owner" do
    user = user()
    stock(user.username)
    funded = fund(user, 6_000)
    assert {:ok, _result} = Realtor.build(funded, "brewery")

    assert :ok = FarmProps.place(user.username, "brewery", 400, 400)
    refute Map.has_key?(FarmProps.inventory(user.username), "brewery")

    assert :ok = FarmProps.dig(user.username, 100)
    assert FarmProps.inventory(user.username)["brewery"] == 1

    assert FarmProps.owner_only?(%{"kind" => "place", "asset" => "brewery"})
    assert FarmProps.owner_only?(%{"kind" => "dig", "index" => 100})
    refute FarmProps.owner_only?(%{"kind" => "dig", "index" => 2})
  end

  test "a property can only be built once" do
    user = user()
    stock(user.username)
    funded = fund(user, 6_000)

    assert {:ok, _result} = Realtor.build(funded, "brewery")
    assert {:error, "already built"} = Realtor.build(funded, "brewery")
  end

  test "construction is rejected without enough materials or funds" do
    user = user()
    fund(user, 6_000)

    assert {:error, "not enough materials: " <> missing} = Realtor.build(user, "brewery")
    assert missing =~ "wood-plank"
    assert missing =~ "stone"
    assert missing =~ "nails"

    stock(user.username)
    funded = fund(user, 10)

    assert {:error, "insufficient funds"} = Realtor.build(funded, "brewery")
    assert Realtor.owned(user.username) == []
  end

  test "unknown properties are rejected" do
    user = user()
    assert {:error, "unknown property"} = Realtor.build(user, "castle")
    assert {:error, "invalid property"} = Realtor.build(user, nil)
  end
end
