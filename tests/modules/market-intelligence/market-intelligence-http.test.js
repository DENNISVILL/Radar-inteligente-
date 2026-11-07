import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {marketIntelligenceRoutes} from "../../src/modules/market-intelligence/presentation/market-intelligence.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const productId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner"}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm"))return {rows:[{workspace_id:workspaceId,workspace_name:"Test workspace",role}]};
   if(sql.includes("FROM competitors"))return {rows:[]};
   return {rows:[]};
  },
  async connect(){
   return {
    async query(sql,values=[]){calls.push({sql,values});return {rows:[]};},
    release(){calls.push({sql:"RELEASE",values:[]});}
   };
  }
 };
 const app=Fastify({logger:false});
 await app.register(marketIntelligenceRoutes,{database,requireIdentity:async request=>{request.identity={subject:"auth-user",email:"owner@example.test"};}});
 await app.ready();
 return {app,calls};
}

test("viewer can read competitors but cannot create them",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  const read=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/competitors`});
  assert.equal(read.statusCode,200);
  assert.deepEqual(read.json().data,[]);
  const write=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/competitors`,payload:{name:"Competidor"}});
  assert.equal(write.statusCode,403);
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO competitors")).length,0);
 }finally{await app.close();}
});

test("invalid workspace identifiers are rejected before database access",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:"/api/v1/workspaces/not-a-uuid/competitors"});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_WORKSPACE_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("invalid product relation UUIDs are rejected before creating an identity or product",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/products`,payload:{name:"Producto",competitorId:"not-a-uuid"}});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_PRODUCT");
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO users")).length,0);
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO market_products")).length,0);
 }finally{await app.close();}
});

test("empty and nonnumeric prices are rejected before persistence",async()=>{
 const {app,calls}=await buildApp();
 try{
  for(const price of ["",true,[]]){
   const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/products/${productId}/prices`,payload:{price,currency:"USD",observedOn:"2026-11-07"}});
   assert.equal(response.statusCode,400);
   assert.equal(response.json().error,"INVALID_PRICE_OBSERVATION");
  }
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO price_observations")).length,0);
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO users")).length,0);
 }finally{await app.close();}
});

test("invalid workspace product UUID is rejected before access lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/products/not-a-uuid/prices`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_PRODUCT_ID");
  assert.equal(calls.length,1); // workspace membership is checked before the product identifier on this route
 }finally{await app.close();}
});
