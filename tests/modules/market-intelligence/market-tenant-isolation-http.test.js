import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {marketIntelligenceRoutes} from "../../../src/modules/market-intelligence/presentation/market-intelligence.routes.js";
import {marketReportRoutes} from "../../../src/modules/market-intelligence/presentation/market-report.routes.js";

const workspaceA="11111111-1111-4111-8111-111111111111";
const workspaceB="33333333-3333-4333-8333-333333333333";
const researchId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner",memberships=[workspaceA]}={}) {
 const calls=[];
 const database={
  async query(sql,values=[]) {
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm")) {
    const workspaceId=values[1];
    return {rows:memberships.includes(workspaceId)?[{workspace_id:workspaceId,workspace_name:"Workspace",role}]:[]};
   }
   return {rows:[]};
  },
  async connect() {
   return {async query(sql,values=[]) {calls.push({sql,values});return {rows:[]};},release(){}};
  }
 };
 const app=Fastify({logger:false});
 const options={database,requireIdentity:async request=>{request.identity={subject:"auth-user",email:"user@example.test"};}};
 await app.register(marketIntelligenceRoutes,options);
 await app.register(marketReportRoutes,options);
 await app.ready();
 return {app,calls};
}

test("workspace A cannot read competitors belonging to workspace B",async()=>{
 const {app,calls}=await buildApp();
 try {
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceB}/competitors`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM competitors")),false);
 } finally {await app.close();}
});

test("workspace A cannot read a report for workspace B",async()=>{
 const {app,calls}=await buildApp();
 try {
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceB}/researches/${researchId}/report`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM researches")||call.sql.includes("FROM market_reports")),false);
 } finally {await app.close();}
});

test("viewer cannot create a product or open a report snapshot",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try {
  const product=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/products`,payload:{name:"Producto de prueba",category:"service"}});
  assert.equal(product.statusCode,403);
  assert.equal(product.json().error,"FORBIDDEN");
  const snapshot=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceA}/researches/${researchId}/reports`});
  assert.equal(snapshot.statusCode,403);
  assert.equal(snapshot.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO market_products")||call.sql.includes("INSERT INTO market_reports")),false);
  assert.equal(calls.some(call=>call.sql==="BEGIN ISOLATION LEVEL REPEATABLE READ"),false);
 } finally {await app.close();}
});

test("viewer cannot read workspace audit logs",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try {
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceA}/audit-logs`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("FROM audit_logs")),false);
 } finally {await app.close();}
});

test("a non-member cannot mutate market data in another workspace",async()=>{
 const {app,calls}=await buildApp({memberships:[]});
 try {
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceB}/competitors`,payload:{name:"Competidor externo"}});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO competitors")||call.sql.includes("INSERT INTO audit_logs")),false);
 } finally {await app.close();}
});
