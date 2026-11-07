import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {researchRoutes} from "../../../src/modules/research/presentation/research.routes.js";

const workspaceA="11111111-1111-4111-8111-111111111111";
const workspaceB="33333333-3333-4333-8333-333333333333";
const researchId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner",accessibleWorkspaces=[workspaceA]}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm")){
    const workspaceId=values[1];
    return {rows:accessibleWorkspaces.includes(workspaceId)?[{workspace_id:workspaceId,workspace_name:"Workspace",role}]:[]};
   }
   if(sql.includes("FROM researches")){
    return {rows:[{id:researchId,workspace_id:values[0],title:"Estudio",status:"draft"}]};
   }
   return {rows:[]};
  }
 };
 const app=Fastify({logger:false});
 await app.register(researchRoutes,{database,requireIdentity:async request=>{request.identity={subject:"auth-user",email:"user@example.test"};}});
 await app.ready();
 return {app,calls};
}

test("research list is scoped to the authorized workspace",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches`});
  assert.equal(response.statusCode,200);
  assert.equal(response.json().data[0].workspace_id,workspaceA);
  const query=calls.find(call=>call.sql.includes("FROM researches"));
  assert.deepEqual(query.values,[workspaceA,50]);
 }finally{await app.close();}
});

test("a member of one workspace cannot read another workspace's research",async()=>{
 const {app,calls}=await buildApp({accessibleWorkspaces:[workspaceA]});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceB}/researches/${researchId}`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM researches")),false);
 }finally{await app.close();}
});

test("viewer cannot create research and is denied before identity creation or persistence",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{
   title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"
  }});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO researches")),false);
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO users")),false);
 }finally{await app.close();}
});

test("malformed research identifiers are rejected before workspace lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/not-a-uuid`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("research list rejects invalid status and pagination before querying research data",async()=>{
 const {app,calls}=await buildApp();
 try{
  const invalidStatus=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches?status=deleted`});
  assert.equal(invalidStatus.statusCode,400);
  assert.equal(invalidStatus.json().error,"INVALID_STATUS");
  const invalidLimit=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches?limit=101`});
  assert.equal(invalidLimit.statusCode,400);
  assert.equal(invalidLimit.json().error,"INVALID_LIMIT");
  assert.equal(calls.filter(call=>call.sql.includes("FROM researches")).length,0);
 }finally{await app.close();}
});
