import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {identityRoutes} from "../../../src/modules/identity/presentation/identity.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const researchId="22222222-2222-4222-8222-222222222222";

async function buildApp() {
 const calls=[];
 const database={async query(sql,values=[]) {calls.push({sql,values});return {rows:[]};},async connect(){throw new Error("No debe abrirse una conexión sin autenticación.");}};
 const app=Fastify({logger:false});
 await app.register(identityRoutes,{database,config:{supabaseUrl:""}});
 await app.ready();
 return {app,calls};
}

test("anonymous requests are rejected consistently across protected API modules",async()=>{
 const {app,calls}=await buildApp();
 const protectedRequests=[
  ["GET","/api/v1/me"],
  ["GET","/api/v1/workspaces"],
  ["POST","/api/v1/workspaces"],
  ["GET",`/api/v1/workspaces/${workspaceId}/members`],
  ["GET",`/api/v1/workspaces/${workspaceId}/invitations`],
  ["GET",`/api/v1/workspaces/${workspaceId}/researches`],
  ["GET",`/api/v1/workspaces/${workspaceId}/competitors`],
  ["GET",`/api/v1/workspaces/${workspaceId}/products`],
  ["GET",`/api/v1/workspaces/${workspaceId}/researches/${researchId}/report`],
  ["GET",`/api/v1/workspaces/${workspaceId}/audit-logs`]
 ];
 try {
  for(const [method,url] of protectedRequests) {
   const response=await app.inject({method,url});
   assert.equal(response.statusCode,401,`${method} ${url} must reject anonymous access`);
   assert.equal(response.json().error,"UNAUTHORIZED");
  }
  assert.equal(calls.length,0,"database must not be queried for anonymous requests");
 } finally {await app.close();}
});



test("malformed authorization headers are rejected consistently without database access",async()=>{
 const {app,calls}=await buildApp();
 const protectedRequests=[
  ["GET","/api/v1/me"],
  ["GET","/api/v1/workspaces"],
  ["GET",`/api/v1/workspaces/${workspaceId}/members`],
  ["GET",`/api/v1/workspaces/${workspaceId}/invitations`],
  ["GET",`/api/v1/workspaces/${workspaceId}/researches`],
  ["GET",`/api/v1/workspaces/${workspaceId}/competitors`],
  ["GET",`/api/v1/workspaces/${workspaceId}/products`],
  ["GET",`/api/v1/workspaces/${workspaceId}/researches/${researchId}/reports`],
  ["GET",`/api/v1/workspaces/${workspaceId}/audit-logs`]
 ];
 const headersList=[{authorization:"Basic abc"},{authorization:"Bearer"},{authorization:"Bearer token with-spaces"}];
 try{
  for(const [method,url] of protectedRequests){
   for(const headers of headersList){
    const response=await app.inject({method,url,headers});
    assert.equal(response.statusCode,401,`${method} ${url} ${headers.authorization}`);
    assert.equal(response.json().error,"UNAUTHORIZED");
   }
  }
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("a bearer token is not accepted as authenticated when Supabase is not configured",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:"/api/v1/me",headers:{authorization:"Bearer syntactically-present-token"}});
  assert.equal(response.statusCode,503);
  assert.equal(response.json().error,"AUTH_NOT_CONFIGURED");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});
