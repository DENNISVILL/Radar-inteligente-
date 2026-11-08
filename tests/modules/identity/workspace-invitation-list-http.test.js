import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { workspaceInvitationRoutes } from "../../../src/modules/identity/presentation/workspace-invitation.routes.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";

async function buildApp() {
  const calls = [];
  const database = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("FROM workspace_members wm")) {
        return { rows: [{ workspace_id: workspaceId, workspace_name: "Workspace", role: "owner" }] };
      }
      if (sql.includes("FROM workspace_invitations")) {
        return { rows: [] };
      }
      return { rows: [] };
    }
  };
  const app = Fastify({ logger: false });
  await app.register(workspaceInvitationRoutes, {
    database,
    requireIdentity: async request => {
      request.identity = { subject: "owner-subject", email: "owner@example.test" };
    }
  });
  await app.ready();
  return { app, calls };
}

test("pending invitation listing uses a bounded default and accepts a valid limit", async () => {
  const { app, calls } = await buildApp();
  try {
    const defaultResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/invitations`
    });
    assert.equal(defaultResponse.statusCode, 200);
    const defaultQuery = calls.find(call => call.sql.includes("FROM workspace_invitations"));
    assert.deepEqual(defaultQuery.values, [workspaceId, 50]);
    calls.length = 0;

    const limitedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/invitations?limit=20`
    });
    assert.equal(limitedResponse.statusCode, 200);
    const limitedQuery = calls.find(call => call.sql.includes("FROM workspace_invitations"));
    assert.deepEqual(limitedQuery.values, [workspaceId, 20]);
    assert.match(limitedQuery.sql, /LIMIT \$2/);
  } finally {
    await app.close();
  }
});

test("pending invitation listing rejects invalid or excessive limits before querying invitations", async () => {
  const { app, calls } = await buildApp();
  try {
    for (const value of ["0", "101", "-1", "1.5", "many"]) {
      calls.length = 0;
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceId}/invitations?limit=${value}`
      });
      assert.equal(response.statusCode, 400, value);
      assert.equal(response.json().error, "INVALID_LIMIT", value);
      assert.equal(calls.some(call => call.sql.includes("FROM workspace_invitations")), false, value);
    }
  } finally {
    await app.close();
  }
});
