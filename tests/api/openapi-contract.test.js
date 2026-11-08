import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const readSpec=()=>readFile(new URL("../../docs/api/openapi.yaml",import.meta.url),"utf8");

test("OpenAPI contract documents the API version, bearer auth and core backend routes",async()=>{
 const spec=await readSpec();
 assert.match(spec,/^openapi: 3\.1\.0/m);
 assert.match(spec,/^security:\n  - bearerAuth: \[\]/m);
 for(const path of [
  "/health","/ready","/api/v1/me","/api/v1/workspaces",
  "/api/v1/workspaces/{workspaceId}/access",
  "/api/v1/workspaces/{workspaceId}/members",
  "/api/v1/workspaces/{workspaceId}/members/{userId}",
  "/api/v1/workspaces/{workspaceId}/invitations",
  "/api/v1/workspaces/{workspaceId}/invitations/{invitationId}",
  "/api/v1/invitations/accept",
  "/api/v1/workspaces/{workspaceId}/researches",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}",
  "/api/v1/workspaces/{workspaceId}/competitors",
  "/api/v1/workspaces/{workspaceId}/competitors/{competitorId}",
  "/api/v1/workspaces/{workspaceId}/products",
  "/api/v1/workspaces/{workspaceId}/products/{productId}",
  "/api/v1/workspaces/{workspaceId}/products/{productId}/prices",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/observations",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/analysis",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/report",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports/{reportId}",
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports/{reportId}/pdf",
  "/api/v1/workspaces/{workspaceId}/audit-logs",
  "/api/v1/workspaces/{workspaceId}/audit-logs/export"
 ])assert.ok(spec.includes(path+":"),`OpenAPI path missing: ${path}`);
});

test("OpenAPI documents every implemented HTTP method for each route",async()=>{
 const spec=await readSpec();
 const operations={
  "/health":["get"],"/ready":["get"],"/api/v1/me":["get"],
  "/api/v1/workspaces":["get","post"],
  "/api/v1/workspaces/{workspaceId}/access":["get"],
  "/api/v1/workspaces/{workspaceId}/members":["get","post"],
  "/api/v1/workspaces/{workspaceId}/members/{userId}":["patch","delete"],
  "/api/v1/workspaces/{workspaceId}/invitations":["get","post"],
  "/api/v1/workspaces/{workspaceId}/invitations/{invitationId}":["delete"],
  "/api/v1/invitations/accept":["post"],
  "/api/v1/workspaces/{workspaceId}/researches":["get","post"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}":["get","patch","delete"],
  "/api/v1/workspaces/{workspaceId}/competitors":["get","post"],
  "/api/v1/workspaces/{workspaceId}/competitors/{competitorId}":["patch","delete"],
  "/api/v1/workspaces/{workspaceId}/products":["get","post"],
  "/api/v1/workspaces/{workspaceId}/products/{productId}":["patch","delete"],
  "/api/v1/workspaces/{workspaceId}/products/{productId}/prices":["get","post"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/observations":["get","post"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/analysis":["get"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/report":["get"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports":["get","post"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports/{reportId}":["get"],
  "/api/v1/workspaces/{workspaceId}/researches/{researchId}/reports/{reportId}/pdf":["get"],
  "/api/v1/workspaces/{workspaceId}/audit-logs":["get"],
  "/api/v1/workspaces/{workspaceId}/audit-logs/export":["get"]
 };
 for(const [path,methods] of Object.entries(operations)){
  const start=spec.indexOf(`  ${path}:\n`);
  assert.notEqual(start,-1,`OpenAPI path missing: ${path}`);
  const next=spec.indexOf("\n  /",start+1);
  const block=spec.slice(start,next===-1?spec.length:next);
  for(const method of methods)assert.match(block,new RegExp(`^    ${method}:\\s*$`, "m"),`${method.toUpperCase()} ${path} missing from OpenAPI`);
 }
});

test("OpenAPI patch schemas allow partial payloads without requiring create fields",async()=>{
 const spec=await readSpec();
 const lines=spec.split("\n");
 for(const schema of ["ResearchPatch","CompetitorPatch","ProductPatch"]){
  const start=lines.findIndex(line=>line===`    ${schema}:`);
  assert.notEqual(start,-1);
  const block=[];
  for(let index=start;index<lines.length;index++){
   if(index>start&&/^    [A-Z][A-Za-z]+:$/.test(lines[index]))break;
   block.push(lines[index]);
  }
  const schemaBlock=block.join("\n");
  assert.match(schemaBlock,/minProperties: 1/);
  assert.doesNotMatch(schemaBlock,/required:/);
 }
});
