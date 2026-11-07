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

test("creates a workspace and owner membership in one transaction", async () => {
  const statements = [];
  const client = {
    query: async (sql, params) => {
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      if (sql.includes("RETURNING id, name, slug")) return { rows: [{ id: "w1", name: params[0], slug: params[1] }] };
      return { rows: [] };
    },
    release: () => {}
  };
  const database = { connect: async () => client };
  const result = await createWorkspace(database, "u1", "Mi Empresa");
  assert.equal(result.role, "owner");
  assert.deepEqual(statements, ["BEGIN", "INSERT INTO workspaces", "INSERT INTO workspace_members", "COMMIT"]);
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
