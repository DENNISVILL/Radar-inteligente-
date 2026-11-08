import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {marketReportRoutes} from "../../../src/modules/market-intelligence/presentation/market-report.routes.js";

const workspaceA="11111111-1111-4111-8111-111111111111";
const workspaceB="33333333-3333-4333-8333-333333333333";
const researchId="22222222-2222-4222-8222-222222222222";
const reportId="44444444-4444-4444-8444-444444444444";

async function buildApp({role="owner",accessibleWorkspaces=[workspaceA],reportRows=[]}={}){
 const calls=[];
 let connectCalls=0;
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm")){
    const workspaceId=values[1];
    return {rows:accessibleWorkspaces.includes(workspaceId)?[{workspace_id:workspaceId,workspace_name:"Workspace",role}]:[]};
   }
   if(sql.includes("FROM market_reports"))return {rows:reportRows};
   if(sql.includes("FROM audit_logs"))return {rows:[{id:"audit-1",event_type:"market_report.snapshot_created"}]};
   if(sql.includes("FROM researches"))return {rows:[]};
   if(sql.includes("INSERT INTO users"))return {rows:[{id:"user-1",email:"owner@example.test",status:"active"}]};
   return {rows:[]};
  },
  async connect(){connectCalls++;throw new Error("No se esperaba abrir una conexión en esta prueba");}
 };
 const app=Fastify({logger:false});
 await app.register(marketReportRoutes,{database,requireIdentity:async request=>{request.identity={subject:"auth-user",email:"user@example.test"};}});
 await app.ready();
 return {app,calls,getConnectCalls:()=>connectCalls};
}

test("a member cannot list report snapshots from another workspace",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceB}/researches/${researchId}/reports`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM market_reports")),false);
 }finally{await app.close();}
});

test("viewer can read report history and the query is scoped to workspace and research",async()=>{
 const {app,calls}=await buildApp({role:"viewer",reportRows:[{id:reportId,version:2,integrity_verified:true}]});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports?limit=20`});
  assert.equal(response.statusCode,200);
  assert.equal(response.json().data[0].id,reportId);
  const query=calls.find(call=>call.sql.includes("FROM market_reports"));
  assert.deepEqual(query.values,[workspaceA,researchId,20]);
 }finally{await app.close();}
});

test("viewer cannot create a report snapshot or open a database transaction",async()=>{
 const {app,calls,getConnectCalls}=await buildApp({role:"viewer"});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO users")),false);
  assert.equal(getConnectCalls(),0);
 }finally{await app.close();}
});

test("viewer cannot read workspace audit logs",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/audit-logs`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM audit_logs")),false);
 }finally{await app.close();}
});

test("report history rejects invalid limits instead of silently coercing them",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  for(const value of ["0","51","1.5","abc","2abc"]){
   const response=await app.inject({method:"GET",url:"/api/v1/workspaces/"+workspaceA+"/researches/"+researchId+"/reports?limit="+value});
   assert.equal(response.statusCode,400,value);
   assert.equal(response.json().error,"INVALID_LIMIT",value);
  }
  assert.equal(calls.some(call=>call.sql.includes("FROM market_reports")),false);
 }finally{await app.close();}
});

test("audit log history rejects invalid limits instead of silently coercing them",async()=>{
 const {app,calls}=await buildApp({role:"admin"});
 try{
  for(const value of ["0","101","1.5","abc","2abc"]){
   const response=await app.inject({method:"GET",url:"/api/v1/workspaces/"+workspaceA+"/audit-logs?limit="+value});
   assert.equal(response.statusCode,400,value);
   assert.equal(response.json().error,"INVALID_LIMIT",value);
  }
  assert.equal(calls.some(call=>call.sql.includes("FROM audit_logs")),false);
 }finally{await app.close();}
});
test("malformed report identifiers are rejected before querying snapshots",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports/not-a-uuid/pdf`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_REPORT_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("PDF export refuses a snapshot whose integrity hash does not match",async()=>{
 const {app,calls}=await buildApp({reportRows:[{id:reportId,version:1,integrity_verified:false,report_data:{research:{title:"Test"}}}]});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports/${reportId}/pdf`});
  assert.equal(response.statusCode,409);
  assert.equal(response.json().error,"REPORT_INTEGRITY_FAILED");
  const query=calls.find(call=>call.sql.includes("FROM market_reports"));
  assert.deepEqual(query.values,[workspaceA,researchId,reportId]);
 }finally{await app.close();}
});

test("a foreign-workspace report ID cannot be fetched through another workspace and research",async()=>{
 const {app,calls}=await buildApp({reportRows:[]});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports/${reportId}`});
  assert.equal(response.statusCode,404);
  assert.equal(response.json().error,"REPORT_NOT_FOUND");
  const query=calls.find(call=>call.sql.includes("FROM market_reports"));
  assert.deepEqual(query.values,[workspaceA,researchId,reportId]);
 }finally{await app.close();}
});

test("invalid workspace identifiers are rejected before membership lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/invalid/researches/${researchId}/reports`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_WORKSPACE_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});
