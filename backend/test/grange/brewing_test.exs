defmodule Grange.BrewingTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, Barn, Brewery, Brewing, FarmStore, Repo}

  setup do
    FarmStore.reset()
    Accounts.reset()
    :ok
  end

  defp build(owner \\ "Alice") do
    FarmStore.ensure(owner)

    Repo.insert!(%Brewery{owner: owner, property: "brewery"})
  end

  defp action(owner, kind, extra \\ %{}) do
    Brewing.action(owner, Map.merge(%{"kind" => kind}, extra))
  end

  test "ten wheat become one beer after the timer" do
    build()
    Barn.add("Alice", "wheat", 10)

    assert {:ok, inserted} = action("Alice", "insert", %{"item" => "wheat"})
    assert inserted.brewery.input_item == "wheat"
    assert inserted.brewery.output_item == "beer"
    assert Barn.map("Alice")["wheat"] == 0

    assert {:ok, started} = action("Alice", "start")
    assert started.brewery.status == "brewing"
    assert started.brewery.ready_at == started.brewery.started_at + Brewing.brew_ms()

    assert FarmStore.tick(started.brewery.ready_at) == ["Alice"]
    assert Barn.map("Alice")["beer"] == 1

    finished = Brewing.status("Alice")
    assert finished.status == "idle"
    assert finished.input_item == nil
    assert finished.last_output == "beer"
  end

  test "tomato and lettuce make their juices" do
    build()
    Barn.add("Alice", "tomato", 10)
    Barn.add("Alice", "lettuce", 10)

    assert {:ok, tomato} = action("Alice", "insert", %{"item" => "tomato"})
    assert tomato.brewery.output_item == "tomato_juice"
    assert {:ok, _} = action("Alice", "remove")
    assert Barn.map("Alice")["tomato"] == 10

    assert {:ok, lettuce} = action("Alice", "insert", %{"item" => "lettuce"})
    assert lettuce.brewery.output_item == "lettuce_juice"
  end

  test "ten crops are required and rare crops are rejected" do
    build()
    Barn.add("Alice", "wheat", 9)
    Barn.add("Alice", "midas_wheat", 10)

    assert {:error, "you need 10 wheat in your barn"} =
             action("Alice", "insert", %{"item" => "wheat"})

    assert {:error, message} = action("Alice", "insert", %{"item" => "midas_wheat"})
    assert message =~ "standard wheat"
    assert Barn.map("Alice")["midas_wheat"] == 10
  end

  test "a batch can only be brewing once" do
    build()
    Barn.add("Alice", "wheat", 10)
    assert {:ok, _} = action("Alice", "insert", %{"item" => "wheat"})
    assert {:ok, _} = action("Alice", "start")

    assert {:error, "the brewery is busy"} =
             action("Alice", "insert", %{"item" => "wheat"})

    assert {:error, "the brewery is already brewing"} = action("Alice", "start")
  end

  test "removing crops returns them to the barn" do
    build()
    Barn.add("Alice", "wheat", 10)
    assert {:ok, _} = action("Alice", "insert", %{"item" => "wheat"})

    assert {:ok, removed} = action("Alice", "remove")
    assert removed.brewery.input_item == nil
    assert Barn.map("Alice")["wheat"] == 10
  end

  test "no brewery means no brewing" do
    FarmStore.ensure("Bob")
    assert {:error, "build a brewery first"} = action("Bob", "insert", %{"item" => "wheat"})
  end
end
