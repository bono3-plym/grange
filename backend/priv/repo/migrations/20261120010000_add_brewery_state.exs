defmodule Grange.Repo.Migrations.AddBreweryState do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:breweries) do
      add(:status, :string, null: false, default: "idle")
      add(:input_item, :string)
      add(:input_count, :integer, null: false, default: 0)
      add(:output_item, :string)
      add(:started_at, :integer)
      add(:ready_at, :integer)
      add(:last_output, :string)
      add(:last_output_at, :integer)
    end
  end
end
