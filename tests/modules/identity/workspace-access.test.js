import test from "node:test";
import assert from "node:assert/strict";
import { canAccessWorkspace, findWorkspaceAccess } from "../../../src/modules/identity/application/workspace-access.js";
import { readBearerToken } from "../../../src/modules/identity/infrastructure/supabase-jwt.js";

test("accepts only defined workspace roles", () => {
  assert.equal(canAccessWorkspace({ role: "owner" }), true);
  assert.equal(canAccessWorkspace({ role: "analyst" }), true);
  assert.equal(canAccessWorkspace({ role: "unknown" }), false);
  assert.equal(canAccessWorkspace(null), false);
});
test("supports role restrictions", () => {
  assert.equal(canAccessWorkspace({ role: "viewer" }, ["owner", "admin"]), false);
  assert.equal(canAccessWorkspace({ role: "admin" }, ["owner", "admin"]), true);
});
test("extracts a Bearer token safely", () => {
  assert.equal(readBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(readBearerToken("Basic abc"), null);
  assert.equal(readBearerToken(undefined), null);
});
test("queries membership using parameterized values", async () => {
  let query;
  const db = { query: async (...args) => { query = args; return { rows: [{ workspace_id: "id", role: "owner" }] }; } };
  const result = await findWorkspaceAccess(db, "auth-user", "workspace-id");
  assert.equal(result.role, "owner");
  assert.deepEqual(query[1], ["auth-user", "workspace-id"]);
  assert.match(query[0], /u\.auth_subject = \$1/);
});
