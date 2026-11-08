import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, listUserWorkspaces } from "../../../src/modules/identity/application/workspaces.js";

test("lists only workspaces belonging to the authenticated local user", async () => {
  let args;
  const database = { query: async (...values) => { args = values; return { rows: [{ id: "w1", role: "owner" }] }; } };
  const rows = await listUserWorkspaces(database, "u1");
  assert.equal(rows[0].id, "w1");
  assert.deepEqual(args[1], ["u1"]);
});

test("creates workspace, initial owner membership and both audit events in one transaction", async () => {
  const statements = [];
  const auditRows = [];
  const client = {
    query: async (sql, params = []) => {
      statements.push(sql.trim().split(/\\s+/).slice(0, 3).join(" "));
      if (sql.includes("RETURNING id, name, slug")) return { rows: [{ id: "w1", name: params[0], slug: params[1] }] };
      if (sql.includes("INSERT INTO audit_logs")) auditRows.push({ sql, params });
      return { rows: [] };
    },
    release: () => { statements.push("RELEASE"); }
  };
  const result = await createWorkspace({ connect: async () => client }, "u1", "Mi Empresa");
  assert.equal(result.role, "owner");
  assert.deepEqual(statements, [
    "BEGIN",
    "INSERT INTO workspaces",
    "INSERT INTO workspace_members",
    "INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)",
    "INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)",
    "COMMIT",
    "RELEASE"
  ]);
  assert.equal(auditRows.length, 2);
  assert.deepEqual(auditRows[0].params, ["w1", "u1", "w1"]);
  assert.match(auditRows[0].sql, /workspace\\.created/);
  assert.deepEqual(auditRows[1].params, ["w1", "u1", "u1"]);
  assert.match(auditRows[1].sql, /workspace_member\\.added/);
});

test("rolls back workspace creation when owner membership fails", async () => {
  const statements = [];
  const client = {
    query: async sql => {
      statements.push(sql.trim());
      if (sql.includes("INSERT INTO workspace_members")) throw new Error("membership failed");
      if (sql.includes("RETURNING id, name, slug")) return { rows: [{ id: "w1", name: "Test", slug: "test-123" }] };
      return { rows: [] };
    },
    release: () => {}
  };
  await assert.rejects(() => createWorkspace({ connect: async () => client }, "u1", "Test"), /membership failed/);
  assert.ok(statements.includes("ROLLBACK"));
});

test("rolls back workspace and owner membership if either audit event cannot be written", async () => {
  const statements = [];
  let auditCount = 0;
  const client = {
    query: async (sql, params = []) => {
      statements.push(sql.trim());
      if (sql.includes("RETURNING id, name, slug")) return { rows: [{ id: "w1", name: params[0], slug: params[1] }] };
      if (sql.includes("INSERT INTO audit_logs") && ++auditCount === 2) throw new Error("audit unavailable");
      return { rows: [] };
    },
    release: () => { statements.push("RELEASE"); }
  };
  await assert.rejects(() => createWorkspace({ connect: async () => client }, "u1", "Test"), /audit unavailable/);
  assert.ok(statements.includes("ROLLBACK"));
  assert.equal(statements.includes("COMMIT"), false);
  assert.equal(statements.at(-1), "RELEASE");
});
