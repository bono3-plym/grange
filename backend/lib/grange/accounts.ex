defmodule Grange.Accounts do
  @moduledoc """
  In-memory accounts and sessions.

  Users and sessions live in one GenServer so mutations are serialized. Session
  tokens are handed to the client as opaque strings; only a SHA-256 hash is
  stored, so a memory dump cannot be replayed.
  """

  use GenServer

  alias Grange.User

  @username_re ~r/^[a-zA-Z0-9_-]{3,32}$/
  @email_re ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/
  @min_password 8
  @token_bytes 32
  @ttl_ms 30 * 24 * 60 * 60 * 1000
  @lobby_topic "lobby"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @spec register(map()) :: {:ok, User.t()} | {:error, String.t()}
  def register(attrs), do: GenServer.call(__MODULE__, {:register, attrs})

  @spec authenticate(String.t(), String.t()) :: {:ok, User.t()} | {:error, String.t()}
  def authenticate(username, password),
    do: GenServer.call(__MODULE__, {:authenticate, username, password})

  @spec create_session(String.t()) :: String.t()
  def create_session(user_id), do: GenServer.call(__MODULE__, {:create_session, user_id})

  @spec resolve_token(String.t() | nil) :: {:ok, User.t()} | :error
  def resolve_token(token), do: GenServer.call(__MODULE__, {:resolve_token, token})

  @spec destroy_session(String.t() | nil) :: :ok
  def destroy_session(token), do: GenServer.call(__MODULE__, {:destroy_session, token})

  @spec list_users() :: [User.t()]
  def list_users, do: GenServer.call(__MODULE__, :list_users)

  @spec apply_balance_delta(String.t(), integer()) ::
          {:ok, non_neg_integer()} | {:error, String.t()}
  def apply_balance_delta(user_id, delta),
    do: GenServer.call(__MODULE__, {:apply_balance_delta, user_id, delta})

  @spec reset() :: :ok
  def reset, do: GenServer.call(__MODULE__, :reset)

  @impl true
  def init(_opts) do
    {:ok, %{users: %{}, by_username: %{}, by_email: %{}, sessions: %{}}}
  end

  @impl true
  def handle_call({:register, attrs}, _from, state) do
    username = attrs |> fetch(:username) |> String.trim()
    email = attrs |> fetch(:email) |> String.trim() |> String.downcase()
    password = fetch(attrs, :password)

    with :ok <- validate_username(username),
         :ok <- validate_email(email),
         :ok <- validate_password(password),
         :ok <- ensure_unique(state, username, email) do
      user = User.new(%{username: username, email: email, password_hash: hash(password)})
      state = put_user(state, user)
      broadcast_players(state)
      {:reply, {:ok, user}, state}
    else
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:authenticate, username, password}, _from, state) do
    user_id = Map.get(state.by_username, username)
    user = user_id && Map.get(state.users, user_id)

    case user do
      nil ->
        # Hash anyway so a missing account takes the same time as a wrong password.
        _ = hash(password)
        {:reply, {:error, "invalid username or password"}, state}

      %User{} ->
        if Argon2.verify_pass(password, user.password_hash) do
          {:reply, {:ok, user}, state}
        else
          {:reply, {:error, "invalid username or password"}, state}
        end
    end
  end

  def handle_call({:create_session, user_id}, _from, state) do
    token = :crypto.strong_rand_bytes(@token_bytes) |> Base.url_encode64(padding: false)
    expires_at = now_ms() + @ttl_ms

    sessions =
      Map.put(state.sessions, hash_token(token), %{user_id: user_id, expires_at: expires_at})

    {:reply, token, %{state | sessions: sessions}}
  end

  def handle_call({:resolve_token, token}, _from, state) when token in [nil, ""] do
    {:reply, :error, state}
  end

  def handle_call({:resolve_token, token}, _from, state) do
    key = hash_token(token)

    case Map.get(state.sessions, key) do
      nil ->
        {:reply, :error, state}

      session ->
        resolve_session(state, session, key)
    end
  end

  def handle_call({:destroy_session, token}, _from, state) when token in [nil, ""] do
    {:reply, :ok, state}
  end

  def handle_call({:destroy_session, token}, _from, state) do
    {:reply, :ok, %{state | sessions: Map.delete(state.sessions, hash_token(token))}}
  end

  def handle_call(:list_users, _from, state) do
    users = state.users |> Map.values() |> Enum.sort_by(& &1.username)
    {:reply, users, state}
  end

  def handle_call({:apply_balance_delta, user_id, delta}, _from, state) do
    case Map.get(state.users, user_id) do
      nil ->
        {:reply, {:error, "unknown user"}, state}

      %User{} = user ->
        update_balance(state, user, delta)
    end
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, %{users: %{}, by_username: %{}, by_email: %{}, sessions: %{}}}
  end

  defp resolve_session(state, session, key) do
    if now_ms() >= session.expires_at do
      {:reply, :error, %{state | sessions: Map.delete(state.sessions, key)}}
    else
      case Map.get(state.users, session.user_id) do
        nil -> {:reply, :error, state}
        user -> {:reply, {:ok, user}, state}
      end
    end
  end

  # Applies a spend/earn delta, clamping at zero, and returns the new balance.
  defp update_balance(state, user, delta) do
    case validate_delta(delta) do
      :ok ->
        balance = max(0, user.balance + delta)
        {:reply, {:ok, balance}, put_user(state, %{user | balance: balance})}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  defp validate_delta(delta) when is_integer(delta), do: :ok
  defp validate_delta(_delta), do: {:error, "delta must be an integer"}

  defp put_user(state, user) do
    %{
      state
      | users: Map.put(state.users, user.id, user),
        by_username: Map.put(state.by_username, user.username, user.id),
        by_email: Map.put(state.by_email, user.email, user.id)
    }
  end

  defp ensure_unique(state, username, email) do
    cond do
      Map.has_key?(state.by_username, username) -> {:error, "that username is taken"}
      Map.has_key?(state.by_email, email) -> {:error, "that email is already registered"}
      true -> :ok
    end
  end

  defp validate_username(username) do
    if Regex.match?(@username_re, username) do
      :ok
    else
      {:error, "username must be 3-32 characters (letters, numbers, _ or -)"}
    end
  end

  defp validate_email(email) do
    if Regex.match?(@email_re, email) and byte_size(email) <= 254 do
      :ok
    else
      {:error, "a valid email address is required"}
    end
  end

  defp validate_password(password) do
    if String.length(password) >= @min_password do
      :ok
    else
      {:error, "password must be at least #{@min_password} characters"}
    end
  end

  defp fetch(attrs, key) when is_map(attrs) do
    Map.get(attrs, to_string(key)) || Map.get(attrs, key) || ""
  end

  defp hash(password), do: Argon2.hash_pwd_salt(to_string(password), hash_opts())

  # Read from app config instead of Mix.env() so releases (where Mix is not
  # available at runtime) don't crash on register/login.
  defp hash_opts do
    Application.get_env(:grange, :argon2_opts, [])
  end

  defp hash_token(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)

  defp now_ms, do: System.monotonic_time(:millisecond)

  defp broadcast_players(state) do
    players = state.users |> Map.values() |> Enum.map(&%{name: &1.username})
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "players", %{players: players})
  end
end
