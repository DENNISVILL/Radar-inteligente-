const parseBoolean = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  return ["true", "1", "yes"].includes(String(value).toLowerCase());
};
function parseInteger(value,fallback,name,{min=1,max=Number.MAX_SAFE_INTEGER}={}){
 const parsed=Number(value??fallback);
 if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new TypeError(`${name} debe ser un entero entre ${min} y ${max}.`);
 return parsed;
}
export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError("PORT debe ser un entero entre 1 y 65535.");
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) throw new TypeError("NODE_ENV no es válido.");
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const supabaseApiKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY ?? "";
  if (supabaseUrl && !supabaseApiKey) throw new TypeError("SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY es obligatorio cuando SUPABASE_URL está configurado.");
  if (!supabaseUrl && supabaseApiKey) throw new TypeError("SUPABASE_URL es obligatorio cuando se configura una clave pública de Supabase.");
  const supabaseJwtMaxAgeSeconds=parseInteger(env.SUPABASE_JWT_MAX_AGE_SECONDS,3600,"SUPABASE_JWT_MAX_AGE_SECONDS",{min:300,max:86400});
  if (supabaseUrl && !/^https:\/\//.test(supabaseUrl)) throw new TypeError("SUPABASE_URL debe utilizar HTTPS.");
  const rateLimitMax=parseInteger(env.RATE_LIMIT_MAX,120,"RATE_LIMIT_MAX",{min:1,max:10000});
  const rateLimitAuthMax=parseInteger(env.RATE_LIMIT_AUTH_MAX,10,"RATE_LIMIT_AUTH_MAX",{min:1,max:1000});
  const rateLimitWindowMs=parseInteger(env.RATE_LIMIT_WINDOW_MS,60000,"RATE_LIMIT_WINDOW_MS",{min:1000,max:3600000});
  return Object.freeze({
    nodeEnv,host:env.HOST??"127.0.0.1",port,databaseUrl:env.DATABASE_URL??"",
    migrationDatabaseUrl:env.MIGRATION_DATABASE_URL??"",
    databaseSsl:parseBoolean(env.DB_SSL),logLevel:env.LOG_LEVEL??"info",
    supabaseUrl:supabaseUrl.replace(/\/$/,""),supabaseApiKey,supabaseJwtMaxAgeSeconds,
    rateLimitMax,rateLimitAuthMax,rateLimitWindowMs,
    metricsEnabled: parseBoolean(env.METRICS_ENABLED, false)
  });
}
