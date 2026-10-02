defmodule Grange.AccountsTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.Accounts

  setup do
    Accounts.reset()
    :ok
  end

  defp register(attrs \\ %{}) do
    Accounts.register(
      Map.merge(
        %{
          "username" => "Alice",
          "email" => "alice@example.test",
          "password" => "harvest-please"
        },
        attrs
      )
    )
  end

  test "registers a user and hides the password hash in JSON" do
    assert {:ok, user} = register()
    assert user.username == "Alice"
    assert user.email == "alice@example.test"
    refute Map.has_key?(Jason.encode!(user) |> Jason.decode!(), "password_hash")
  end

  test "rejects invalid usernames, emails, and short passwords" do
    assert {:error, message} = register(%{"username" => "ab"})
    assert message =~ "3-32"

    assert {:error, message} = register(%{"email" => "nope"})
    assert message =~ "valid email"

    assert {:error, message} = register(%{"password" => "short"})
    assert message =~ "at least 8"
  end

  test "rejects duplicate usernames and emails" do
    assert {:ok, _user} = register()

    assert {:error, "that username is taken"} =
             register(%{"email" => "other@example.test"})

    assert {:error, "that email is already registered"} =
             register(%{"username" => "Bob"})
  end

  test "authenticates with the right password only" do
    {:ok, user} = register()

    assert {:ok, ^user} = Accounts.authenticate("Alice", "harvest-please")
    assert {:error, "invalid username or password"} = Accounts.authenticate("Alice", "wrong")
    assert {:error, "invalid username or password"} = Accounts.authenticate("Nobody", "whatever")
  end

  test "session tokens resolve to the user and can be destroyed" do
    {:ok, user} = register()
    token = Accounts.create_session(user.id)

    assert {:ok, ^user} = Accounts.resolve_token(token)
    assert :error = Accounts.resolve_token(nil)
    assert :error = Accounts.resolve_token("bogus")

    assert :ok = Accounts.destroy_session(token)
    assert :error = Accounts.resolve_token(token)
  end

  test "list_users is sorted and reset clears everything" do
    {:ok, _} = register(%{"username" => "Charlie", "email" => "c@example.test"})
    {:ok, _} = register(%{"username" => "Alice", "email" => "a@example.test"})

    assert Enum.map(Accounts.list_users(), & &1.username) == ["Alice", "Charlie"]

    assert :ok = Accounts.reset()
    assert Accounts.list_users() == []
  end
end
