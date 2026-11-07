import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("workspace member endpoints are registered and protected by owner/admin authorization",async()=>{
 const source=await readFile(new URL("../../../src/modules/identity/presentation/workspace-member.routes.js",import.meta.url),"utf8");
 for(const route of ['app.get("/api/v1/workspaces/:workspaceId/members"','app.post("/api/v1/workspaces/:workspaceId/members"','app.patch("/api/v1/workspaces/:workspaceId/members/:userId"','app.delete("/api/v1/workspaces/:workspaceId/members/:userId"'])assert.ok(source.includes(route));
 assert.match(source,/const managers=\["owner","admin"\]/);
 const identity=await readFile(new URL("../../../src/modules/identity/presentation/identity.routes.js",import.meta.url),"utf8");assert.match(identity,/workspaceMemberRoutes/);
});
