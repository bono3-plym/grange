defmodule Grange.FarmTick do
  @moduledoc """
  The periodic field sweep, run once a second by `Grange.FarmTicker`.

  Sprinklers water their squares, watered crops ripen to ready, and bare tilled
  ground that has gone untended for `Grange.Farm.till_decay_ms/0` reverts to
  grass. Returns the owners whose farm changed so `Grange.FarmStore` can
  broadcast each affected farm and a single lobby summary.
  """

  import Ecto.Query

  alias Grange.{Farm, FarmSprinklers, Repo, Tile}

  @spec run(integer()) :: [String.t()]
  def run(now) do
    sprinkled = FarmSprinklers.water_tick(now)
    Enum.uniq(sprinkled ++ ripen(now) ++ revert_untended(now)) |> Enum.sort()
  end

  defp ripen(now) do
    tiles =
      Repo.all(
        from(t in Tile,
          where: t.state == :watered and not is_nil(t.ready_at) and t.ready_at <= ^now
        )
      )

    Enum.each(tiles, &Repo.update!(Ecto.Changeset.change(&1, state: :ready)))
    Enum.map(tiles, & &1.owner)
  end

  defp revert_untended(now) do
    deadline = now - Farm.till_decay_ms()

    tiles =
      Repo.all(
        from(t in Tile,
          where: t.state == :tilled and not is_nil(t.tilled_at) and t.tilled_at <= ^deadline
        )
      )

    Enum.each(tiles, &Repo.delete!/1)
    Enum.map(tiles, & &1.owner)
  end
end
