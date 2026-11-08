import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {researchRoutes} from "../../../src/modules/research/presentation/research.routes.js";

const workspaceA="11111111-1111-4111-8111-111111111111";
const workspaceB="33333333-3333-4333-8333-333333333333";
const researchId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner",accessibleWorkspaces=[workspaceA],researchExists=true,auditFailure=false}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(auditFailure&&sql.includes("INSERT INTO audit_logs"))throw new Error("audit unavailable");
   if(sql.includes("FROM workspace_members wm")){
    const workspaceId=values[1];
    return {rows:accessibleWorkspaces.includes(workspaceId)?[{workspace_id:workspaceId,workspace_name:"Workspace",role}]:[]};
   }
   if(sql.includes("INSERT INTO users"))return {rows:[{id:"local-user",email:"user@example.test",status:"active"}]};
   if(sql.includes("INSERT INTO researches"))return {rows:[{id:researchId,workspace_id:values[0],created_by:values[1],title:values[2],status:"draft"}]};
   if(sql.includes("FROM researches")){
    return {rows:researchExists?[{id:researchId,workspace_id:values[0],title:"Estudio",status:"draft"}]:[]};
   }
   return {rows:[]};
  }
 };
 database.connect=async()=>({query:(...args)=>database.query(...args),release:()=>calls.push({sql:"RELEASE",values:[]})});
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


test("viewer cannot update or archive a research",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  const update=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`,payload:{title:"Cambio no permitido"}});
  assert.equal(update.statusCode,403);
  assert.equal(update.json().error,"FORBIDDEN");
  const archive=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`});
  assert.equal(archive.statusCode,403);
  assert.equal(archive.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("UPDATE researches")),false);
 }finally{await app.close();}
});

test("authenticated non-members cannot create research in another workspace",async()=>{
 const {app,calls}=await buildApp({accessibleWorkspaces:[]});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceB}/researches`,payload:{
   title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"
  }});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO researches")),false);
 }finally{await app.close();}
});

test("malformed workspace identifiers are rejected before membership lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:"/api/v1/workspaces/not-a-uuid/researches"});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("invalid research payload is rejected before creating a local identity or research",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{title:""}});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_RESEARCH");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO users")),false);
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO researches")),false);
 }finally{await app.close();}
});


test("research HTTP permissions follow the complete workspace role matrix",async()=>{
 const payload={title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"};
 for(const role of ["owner","admin","analyst","viewer"]){
  const {app,calls}=await buildApp({role});
  try{
   const read=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches`});
   assert.equal(read.statusCode,200,role+" should read research");
   const write=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{...payload}});
   if(role==="viewer"){
    assert.equal(write.statusCode,403);
    assert.equal(write.json().error,"FORBIDDEN");
    assert.equal(calls.some(call=>call.sql.includes("INSERT INTO researches")),false);
   }else{
    assert.equal(write.statusCode,201,role+" should create research");
    assert.ok(calls.some(call=>call.sql.includes("INSERT INTO researches")));
   }
  }finally{await app.close();}
 }
});



test("research read, create, update and archive routes enforce the full role matrix",async()=>{
 for(const role of ["owner","admin","analyst","viewer"]){
  const {app,calls}=await buildApp({role});
  try{
   const read=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`});
   assert.equal(read.statusCode,200,role+" can read research");
   const create=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{
    title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"
   }});
   const update=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`,payload:{title:"Actualizado"}});
   const archive=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`});
   if(role==="viewer"){
    for(const response of [create,update,archive]){
     assert.equal(response.statusCode,403,role+" cannot mutate research");
     assert.equal(response.json().error,"FORBIDDEN");
    }
    assert.equal(calls.some(call=>call.sql.includes("INSERT INTO researches")||call.sql.includes("UPDATE researches")),false);
   }else{
    assert.equal(create.statusCode,201,role+" can create research");
    assert.notEqual(update.statusCode,403,role+" is authorized to attempt update");
    assert.notEqual(archive.statusCode,403,role+" is authorized to attempt archive");
    const scopedUpdates=calls.filter(call=>call.sql.includes("UPDATE researches"));
    assert.ok(scopedUpdates.length>=2);
    for(const call of scopedUpdates){
     assert.deepEqual(call.values.slice(0,2),[workspaceA,researchId]);
     assert.match(call.sql,/WHERE workspace_id=\$1 AND id=\$2/);
    }
   }
  }finally{await app.close();}
 }
});



test("foreign research identifiers inside an authorized workspace resolve as not found and remain workspace-scoped",async()=>{
 const foreignResearchId="55555555-5555-4555-8555-555555555555";
 const {app,calls}=await buildApp({researchExists:false});
 try{
  const read=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${foreignResearchId}`});
  assert.equal(read.statusCode,404);
  assert.equal(read.json().error,"RESEARCH_NOT_FOUND");
  const update=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceA}/researches/${foreignResearchId}`,payload:{title:"Cambio"}});
  assert.equal(update.statusCode,404);
  const archive=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceA}/researches/${foreignResearchId}`});
  assert.equal(archive.statusCode,404);
  const resourceQueries=calls.filter(call=>call.sql.includes("FROM researches")||call.sql.includes("UPDATE researches"));
  assert.ok(resourceQueries.length>=3);
  for(const query of resourceQueries){
   assert.deepEqual(query.values.slice(0,2),[workspaceA,foreignResearchId]);
   assert.match(query.sql,/workspace_id=\$1 AND id=\$2/);
  }
 }finally{await app.close();}
});


test("research creation rolls back when its audit event cannot be written",async()=>{
 const {app,calls}=await buildApp({auditFailure:true});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{
   title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"
  }});
  assert.equal(response.statusCode,500);
  assert.ok(calls.some(call=>call.sql==="BEGIN"));
  assert.ok(calls.some(call=>call.sql==="INSERT INTO researches (workspace_id,created_by,title,country,city,sector,objective) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,workspace_id,created_by,title,country,city,sector,objective,status,created_at,updated_at"));
  assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
  assert.equal(calls.some(call=>call.sql==="COMMIT"),false);
 }finally{await app.close();}
});

test("research mutations write their audit events with the authenticated local actor",async()=>{
 const {app,calls}=await buildApp();
 try{
  const created=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches`,payload:{
   title:"Estudio",country:"Ecuador",sector:"Retail",objective:"Analizar el mercado"
  }});
  assert.equal(created.statusCode,201);
  const updated=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`,payload:{title:"Actualizado"}});
  assert.equal(updated.statusCode,200);
  const archived=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}`});
  assert.equal(archived.statusCode,204);
  const auditCalls=calls.filter(call=>call.sql.includes("INSERT INTO audit_logs"));
  assert.equal(auditCalls.length,3);
  assert.deepEqual(auditCalls.map(call=>call.values.slice(0,5)),[
   [workspaceA,"local-user","research.created","research",researchId],
   [workspaceA,"local-user","research.updated","research",researchId],
   [workspaceA,"local-user","research.archived","research",researchId]
  ]);
 }finally{await app.close();}
});
