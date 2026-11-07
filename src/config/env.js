const parseBoolean = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  return ["true", "1", "yes"].includes(String(value).toLowerCase());
};
export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError("PORT debe ser un entero entre 1 y 65535.");
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) throw new TypeError("NODE_ENV no es válido.");
  const supabaseUrl = env.SUPABASE_URL ?? "";
  if (supabaseUrl && !/^https:\/\//.test(supabaseUrl)) throw new TypeError("SUPABASE_URL debe utilizar HTTPS.");
  return Object.freeze({ nodeEnv, host: env.HOST ?? "127.0.0.1", port, databaseUrl: env.DATABASE_URL ?? "", databaseSsl: parseBoolean(env.DB_SSL), logLevel: env.LOG_LEVEL ?? "info", supabaseUrl: supabaseUrl.replace(/\/$/, "") });
}
