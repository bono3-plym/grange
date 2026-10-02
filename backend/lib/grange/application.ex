defmodule Grange.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: Grange.PubSub},
      Grange.Accounts,
      Grange.FarmStore,
      Grange.FarmTicker,
      GrangeWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Grange.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
