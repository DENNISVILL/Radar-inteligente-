import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("workspace invitation routes are registered and all operations require identity",async()=>{
 const identity=await readFile(new URL("../../../src/modules/identity/presentation/identity.routes.js",import.meta.url),"utf8");
 const routes=await readFile(new URL("../../../src/modules/identity/presentation/workspace-invitation.routes.js",import.meta.url),"utf8");
 assert.match(identity,/import \{ workspaceInvitationRoutes \}/);
 assert.match(identity,/app\.register\(workspaceInvitationRoutes,routeOptions\)/);
 for(const endpoint of [
  'app.get("/api/v1/workspaces/:workspaceId/invitations"',
  'app.post("/api/v1/workspaces/:workspaceId/invitations"',
  'app.delete("/api/v1/workspaces/:workspaceId/invitations/:invitationId"',
  'app.post("/api/v1/invitations/accept"'
 ])assert.ok(routes.includes(endpoint));
 assert.match(routes,/const managers=\["owner","admin"\]/);
 assert.match(routes,/r\.identity\.email/);
 assert.match(routes,/token:result\.token/);
 assert.doesNotMatch(routes,/token_hash/);
});
