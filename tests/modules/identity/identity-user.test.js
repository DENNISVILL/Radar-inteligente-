import test from "node:test";
import assert from "node:assert/strict";
import { ensureIdentityUser } from "../../../src/modules/identity/application/identity-user.js";

test("synchronizes a verified identity without requiring an email claim", async () => {
  let query;
  const database = { query: async (...args) => { query = args; return { rows: [{ id: "user-1", email: null, status: "active" }] }; } };
  const user = await ensureIdentityUser(database, { subject: "auth-1", email: null });
  assert.equal(user.id, "user-1");
  assert.deepEqual(query[1], ["auth-1", null]);
  assert.match(query[0], /ON CONFLICT \(auth_subject\)/);
});

test("blocks disabled local accounts", async () => {
  const database = { query: async () => ({ rows: [{ id: "user-1", status: "disabled" }] }) };
  await assert.rejects(() => ensureIdentityUser(database, { subject: "auth-1", email: null }), { statusCode: 403 });
});
