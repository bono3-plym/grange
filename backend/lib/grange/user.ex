defmodule Grange.User do
  @moduledoc "A registered account. The password hash never leaves the server."

  @derive {Jason.Encoder, only: [:id, :username, :email, :inserted_at]}
  defstruct [:id, :username, :email, :password_hash, :inserted_at]

  @type t :: %__MODULE__{
          id: String.t(),
          username: String.t(),
          email: String.t(),
          password_hash: String.t(),
          inserted_at: String.t()
        }

  @doc "Builds a new user with a generated id and timestamp."
  @spec new(map()) :: t()
  def new(attrs) do
    %__MODULE__{
      id: id(),
      username: attrs.username,
      email: attrs.email,
      password_hash: attrs.password_hash,
      inserted_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  @doc "Returns a random opaque id."
  @spec id() :: String.t()
  def id, do: :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
end
