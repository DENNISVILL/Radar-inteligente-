import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/config/env.js";
test("loads safe defaults", () => { const c = loadConfig({}); assert.equal(c.host, "127.0.0.1"); assert.equal(c.port, 3000); });
test("rejects invalid port", () => assert.throws(() => loadConfig({ PORT: "70000" }), /PORT/));
test("rejects unsupported environment", () => assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV/));
test("parses database SSL", () => assert.equal(loadConfig({ DB_SSL: "true" }).databaseSsl, true));
test("keeps application and migration database URLs separate", () => {
 const c=loadConfig({DATABASE_URL:"postgres://runtime",MIGRATION_DATABASE_URL:"postgres://migrator"});
 assert.equal(c.databaseUrl,"postgres://runtime");
 assert.equal(c.migrationDatabaseUrl,"postgres://migrator");
});

test("loads conservative rate limit defaults", () => {
 const c=loadConfig({});
 assert.equal(c.rateLimitMax,120);
 assert.equal(c.rateLimitAuthMax,10);
 assert.equal(c.rateLimitWindowMs,60000);
});
test("rejects out-of-range rate limit settings", () => {
 assert.throws(() => loadConfig({RATE_LIMIT_MAX:"0"}),/RATE_LIMIT_MAX/);
 assert.throws(() => loadConfig({RATE_LIMIT_AUTH_MAX:"1001"}),/RATE_LIMIT_AUTH_MAX/);
 assert.throws(() => loadConfig({RATE_LIMIT_WINDOW_MS:"999"}),/RATE_LIMIT_WINDOW_MS/);
});

test("metrics are disabled by default and require explicit opt-in", () => {
 assert.equal(loadConfig({}).metricsEnabled, false);
 assert.equal(loadConfig({ METRICS_ENABLED: "false" }).metricsEnabled, false);
 assert.equal(loadConfig({ METRICS_ENABLED: "true" }).metricsEnabled, true);
});

test("loads bounded Supabase JWT age and supports public or legacy anon API keys", () => {
 const defaults=loadConfig({});
 assert.equal(defaults.supabaseJwtMaxAgeSeconds,3600);
 const configured=loadConfig({SUPABASE_URL:"https://project.example.test",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",SUPABASE_JWT_MAX_AGE_SECONDS:"1800"});
 assert.equal(configured.supabaseApiKey,"sb_publishable_test");
 assert.equal(configured.supabaseJwtMaxAgeSeconds,1800);
 const legacy=loadConfig({SUPABASE_URL:"https://project.example.test",SUPABASE_ANON_KEY:"legacy-anon"});
 assert.equal(legacy.supabaseApiKey,"legacy-anon");
});
test("requires the Supabase public API key together with the project URL", () => {
 assert.throws(()=>loadConfig({SUPABASE_URL:"https://project.example.test"}),/SUPABASE_PUBLISHABLE_KEY/);
 assert.throws(()=>loadConfig({SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test"}),/SUPABASE_URL/);
});
test("rejects unsafe Supabase JWT maximum ages", () => {
 assert.throws(()=>loadConfig({SUPABASE_JWT_MAX_AGE_SECONDS:"299"}),/SUPABASE_JWT_MAX_AGE_SECONDS/);
 assert.throws(()=>loadConfig({SUPABASE_JWT_MAX_AGE_SECONDS:"86401"}),/SUPABASE_JWT_MAX_AGE_SECONDS/);
});
