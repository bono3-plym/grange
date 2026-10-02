import Config

config :grange, GrangeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "3200")],
  check_origin: false,
  debug_errors: true,
  server: true

config :grange, enable_test_routes: true
config :logger, level: :info
