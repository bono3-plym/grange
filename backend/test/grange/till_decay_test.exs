defmodule Grange.TillDecayTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Ecto.Query

  alias Grange.{Farm, FarmStore, Inventory, Repo, Tile}

  setup do
    FarmStore.reset()
    :ok
  end

  defp row(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  defp view_tile(owner, x, y) do
    FarmStore.view(owner).tiles |> Enum.find(&(&1.x == x and &1.y == y))
  end

  test "untended tilled soil reverts to grass after the decay window" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})

    tilled_at = row("Alice", 3, 3).tilled_at
    assert is_integer(tilled_at)

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms() - 1) == []
    assert view_tile("Alice", 3, 3).state == :tilled

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]
    assert view_tile("Alice", 3, 3) == nil
  end

  test "planting and watering exempt a tile from the till decay" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 2, "y" => 2})

    assert is_nil(row("Alice", 2, 2).tilled_at)

    now = System.system_time(:millisecond) + Farm.till_decay_ms() * 2
    assert FarmStore.tick(now) == []
    assert view_tile("Alice", 2, 2).state == :planted

    FarmStore.action("Alice", %{"kind" => "water", "x" => 2, "y" => 2})
    assert FarmStore.tick(now + Farm.grow_ms() + 60_000) == ["Alice"]
    assert view_tile("Alice", 2, 2).state == :ready
  end

  test "harvesting back to bare soil restarts the decay clock" do
    FarmStore.ensure("Alice")
    Inventory.add("Alice", "wheat-seed", 1)
    FarmStore.action("Alice", %{"kind" => "till", "x" => 5, "y" => 5})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 5, "y" => 5, "crop" => "wheat"})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 5, "y" => 5})

    FarmStore.tick(System.system_time(:millisecond) + Farm.grow_ms() + 60_000)
    assert view_tile("Alice", 5, 5).state == :ready

    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 5, "y" => 5, "tool" => "scythe"})
    assert view_tile("Alice", 5, 5).state == :tilled

    tilled_at = row("Alice", 5, 5).tilled_at
    assert is_integer(tilled_at)

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms() - 1) == []
    assert view_tile("Alice", 5, 5).state == :tilled

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]
    assert view_tile("Alice", 5, 5) == nil
  end

  test "reverting soil broadcasts the farm and a single lobby summary" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})
    tilled_at = row("Alice", 3, 3).tilled_at

    GrangeWeb.Endpoint.subscribe("farm:Alice")
    GrangeWeb.Endpoint.subscribe("lobby")

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]

    assert_receive %Phoenix.Socket.Broadcast{event: "farmUpdate", topic: "farm:Alice"}
    assert_receive %Phoenix.Socket.Broadcast{event: "farms", topic: "lobby"}
    refute_receive %Phoenix.Socket.Broadcast{event: "farms"}, 50
  end
end
