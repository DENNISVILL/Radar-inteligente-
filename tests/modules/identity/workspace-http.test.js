import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { workspaceRoutes } from "../../../src/modules/identity/presentation/workspace.routes.js";

const identity = { subject: "auth-user", email: "owner@example.test" };

async function buildApp({ userStatus = "active", failMembership = false } = {}) {
  const calls = [];
  const database = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "local-user", email: identity.email, status: userStatus }] };\n      return { rows: [{ id: "workspace-1", name: "Mi Empresa", slug: "mi-empresa", role: "owner" }] };
    },
    async connect() {
      return {
        async query(sql, values = []) {
          calls.push({ sql, values });
          if (sql.includes("RETURNING id, name, slug, created_at")) {
            return { rows: [{ id: "workspace-1", name: values[0], slug: values[1], created_at: new Date() }] };
          }
          if (failMembership && sql.includes("INSERT INTO workspace_members")) {
            throw new Error("membership insert failed");
          }
          return { rows: [] };
        },
        release() { calls.push({ sql: "RELEASE", values: [] }); }
      };
    }
  };
  const app = Fastify({ logger: false });
  await app.register(workspaceRoutes, {
    database,
    requireIdentity: async request => { request.identity = identity; }
  });
  await app.ready();
  return { app, calls };
}

test("HTTP workspace listing is scoped to the authenticated local user and active workspaces", async () => {
  const { app, calls } = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/workspaces" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, [{ id: "workspace-1", name: "Mi Empresa", slug: "mi-empresa", role: "owner" }]);
    const query = calls.find(call => call.sql.includes("FROM workspace_members"));
    assert.deepEqual(query.values, ["local-user"]);
    assert.match(query.sql, /wm\.user_id = \$1/);
    assert.match(query.sql, /w\.status = 'active'/);
  } finally {
    await app.close();
  }
});

test("HTTP workspace creation validates the name before creating a local identity", async () => {
  const { app, calls } = await buildApp();
  try {
    for (const name of ["", "   ", "x".repeat(121), 42, null]) {
      const response = await app.inject({ method: "POST", url: "/api/v1/workspaces", payload: { name } });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error, "INVALID_WORKSPACE_NAME");
    }
    assert.equal(calls.length, 0);
  } finally {
    await app.close();
  }
});

test("HTTP workspace creation creates an owner membership in the same transaction", async () => {
  const { app, calls } = await buildApp();
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/workspaces", payload: { name: "  Mi Empresa  " } });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.name, "Mi Empresa");
    assert.equal(response.json().data.role, "owner");
    assert.deepEqual(calls.filter(call => ["BEGIN", "COMMIT"].includes(call.sql)).map(call => call.sql), ["BEGIN", "COMMIT"]);
    assert.ok(calls.some(call => call.sql.includes("INSERT INTO workspace_members") && call.values[2] === "owner"));
    assert.ok(calls.some(call => call.sql === "RELEASE"));
  } finally {
    await app.close();
  }
});

test("HTTP workspace creation rolls back if the owner membership cannot be created", async () => {
  const { app, calls } = await buildApp({ failMembership: true });
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/workspaces", payload: { name: "Mi Empresa" } });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error, "INTERNAL_SERVER_ERROR");
    assert.ok(calls.some(call => call.sql === "ROLLBACK"));
    assert.equal(calls.some(call => call.sql === "COMMIT"), false);
    assert.ok(calls.some(call => call.sql === "RELEASE"));
  } finally {
    await app.close();
  }
});

test("HTTP workspace endpoints reject disabled local identities", async () => {
  const { app, calls } = await buildApp({ userStatus: "disabled" });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/workspaces" });
    assert.equal(response.statusCode, 403);
    assert.equal(response.statusCode, 403);
    assert.equal(calls.length, 1);
  } finally {
    await app.close();
  }
});
