defmodule Grange.Brewery do
  @moduledoc "A real-estate property a player has built and owns, plus its brew state."

  use Ecto.Schema

  schema "breweries" do
    field(:owner, :string)
    field(:property, :string, default: "brewery")
    field(:status, :string, default: "idle")
    field(:input_item, :string)
    field(:input_count, :integer, default: 0)
    field(:output_item, :string)
    field(:started_at, :integer)
    field(:ready_at, :integer)
    field(:last_output, :string)
    field(:last_output_at, :integer)
    timestamps(updated_at: false)
  end
end
