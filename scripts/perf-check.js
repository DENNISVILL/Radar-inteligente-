import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import Fastify from "fastify";
import pg from "pg";
import { applyMigrations } from "./migrate.js";
import { marketIntelligenceRoutes } from "../src/modules/market-intelligence/presentation/market-intelligence.routes.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL es obligatorio para ejecutar el benchmark.");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
const suffix = randomUUID();
const subject = `perf-${suffix}`;
const email = `perf-${suffix}@example.test`;
let workspaceId;
let userId;
let app;

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function parseConcurrencyLevels() {
  const raw = process.env.PERF_CONCURRENCY_LEVELS
    ?? (process.env.PERF_CONCURRENCY ? String(process.env.PERF_CONCURRENCY) : "1,5,20,50");
  const levels = raw.split(",").map(value => Number(value.trim()));
  if (!levels.length || levels.some(value =>
    !Number.isInteger(value) || value < 1 || value > 100
  )) {
    throw new TypeError("PERF_CONCURRENCY_LEVELS debe contener enteros entre 1 y 100 separados por comas.");
  }
  return [...new Set(levels)];
}

try {
  await applyMigrations(pool);
  const workspace = await pool.query(
    "INSERT INTO workspaces(name,slug) VALUES($1,$2) RETURNING id",
    ["Performance benchmark", `perf-${suffix}`]
  );
  workspaceId = workspace.rows[0].id;
  const user = await pool.query(
    "INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",
    [subject, email]
  );
  userId = user.rows[0].id;
  await pool.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
    [workspaceId, userId]
  );

  await pool.query(
    "INSERT INTO market_products(workspace_id,created_by,name) SELECT $1,$2,'Perf product ' || lpad(n::text,4,'0') FROM generate_series(1,500) AS n",
    [workspaceId, userId]
  );
  await pool.query(
    `INSERT INTO price_observations(workspace_id,product_id,recorded_by,price,currency,observed_on)
     SELECT $1,mp.id,$2,(10 + series.n)::numeric,'USD',CURRENT_DATE - series.n
     FROM market_products mp
     CROSS JOIN generate_series(1,5) AS series(n)
     WHERE mp.workspace_id=$1 AND mp.name LIKE 'Perf product %'`,
    [workspaceId, userId]
  );
  const product = await pool.query(
    "SELECT id FROM market_products WHERE workspace_id=$1 AND name='Perf product 0001'",
    [workspaceId]
  );
  assert.ok(product.rows[0]?.id, "El dataset de benchmark debe contener productos.");
  const productId = product.rows[0].id;

  app = Fastify({ logger: false });
  await app.register(marketIntelligenceRoutes, {
    database: pool,
    requireIdentity: async request => {
      request.identity = { subject };
    }
  });
  await app.ready();

  const productsUrl = `/api/v1/workspaces/${workspaceId}/products?limit=50`;
  const pricesUrl = `/api/v1/workspaces/${workspaceId}/products/${productId}/prices?limit=50`;
  const request = async url => {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200, response.body);
    return response;
  };

  // Warm-up outside the measured scenarios.
  for (let i = 0; i < 10; i += 1) await request(i % 2 ? productsUrl : pricesUrl);

  const levels = parseConcurrencyLevels();
  const iterations = Number(process.env.PERF_ITERATIONS ?? 5);
  const p95MaxMs = Number(process.env.PERF_P95_MAX_MS ?? 1000);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100) {
    throw new TypeError("PERF_ITERATIONS debe estar entre 1 y 100.");
  }
  if (!Number.isFinite(p95MaxMs) || p95MaxMs <= 0) {
    throw new TypeError("PERF_P95_MAX_MS debe ser un número positivo.");
  }

  const scenarios = [];
  for (const concurrency of levels) {
    const latencies = [];
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
      for (let i = 0; i < iterations; i += 1) {
        const url = (worker + i) % 2 ? productsUrl : pricesUrl;
        const before = performance.now();
        await request(url);
        latencies.push(performance.now() - before);
      }
    }));
    const elapsedMs = performance.now() - started;
    const p50 = percentile(latencies, 0.50);
    const p95 = percentile(latencies, 0.95);
    const p99 = percentile(latencies, 0.99);
    const scenario = {
      concurrency,
      requests: latencies.length,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      throughputRps: Number((latencies.length / (elapsedMs / 1000)).toFixed(2)),
      latencyMs: {
        p50: Number(p50.toFixed(2)),
        p95: Number(p95.toFixed(2)),
        p99: Number(p99.toFixed(2)),
        max: Number(Math.max(...latencies).toFixed(2))
      },
      threshold: { p95MaxMs }
    };
    scenarios.push(scenario);
    assert.ok(p95 <= p95MaxMs,
      `Concurrencia ${concurrency}: P95 ${p95.toFixed(2)} ms supera el límite ${p95MaxMs} ms.`);
  }

  console.log("RADAR_PERFORMANCE_BASELINE " + JSON.stringify({
    dataset: { products: 500, priceObservations: 2500 },
    iterationsPerWorker: iterations,
    scenarios
  }));
} finally {
  if (app) await app.close();
  if (workspaceId) await pool.query("DELETE FROM workspaces WHERE id=$1", [workspaceId]);
  if (userId) await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  await pool.end();
}
