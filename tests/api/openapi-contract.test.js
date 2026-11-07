import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("OpenAPI contract documents the API version, bearer auth and core backend routes",async()=>{
 const spec=await readFile(new URL("../../docs/api/openapi.yaml",import.meta.url),"utf8");
 assert.match(spec,/^openapi: 3\.1\.0/m);
 assert.match(spec,/bearerAuth:/);
 for(const path of [
  "/api/v1/me",
  "/api/v1/workspaces",
  "/api/v1/workspaces/{workspaceId}/members",
  "/api/v1/workspaces/{workspaceId}/invitations",
  "/api/v1/invitations/accept",
  "/api/v1/workspaces/{workspaceId}/researches",
  "/api/v1/workspaces/{workspaceId}/competitors",
  "/api/v1/workspaces/{workspaceId}/products",
  "/api/v1/workspaces/{workspaceId}/products/{productId}/prices",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/observations",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/analysis",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/report",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports",
  "/api/v1/workspaces/{workspaceId}/audit-logs"
 ])assert.ok(spec.includes(path),`OpenAPI path missing: ${path}`);
});

test("OpenAPI patch schemas allow partial payloads without requiring create fields",async()=>{
 const spec=await readFile(new URL("../../docs/api/openapi.yaml",import.meta.url),"utf8");
 for(const schema of ["ResearchPatch","CompetitorPatch","ProductPatch"]){
  const start=spec.indexOf(`    ${schema}:`);
  assert.notEqual(start,-1);
  const end=spec.indexOf("\n    ",start+5);
  const block=spec.slice(start,end===-1?undefined:end);
  assert.match(block,/minProperties: 1/);
  assert.doesNotMatch(block,/required:/);
 }
});
