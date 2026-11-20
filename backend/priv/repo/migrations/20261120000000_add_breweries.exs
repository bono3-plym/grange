defmodule Grange.Repo.Migrations.AddBreweries do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:breweries) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:property, :string, null: false, default: "brewery")
      timestamps(updated_at: false)
    end

    create(unique_index(:breweries, [:owner, :property]))
  end
end
