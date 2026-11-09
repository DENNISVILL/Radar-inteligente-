import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {marketIntelligenceRoutes} from "../../../src/modules/market-intelligence/presentation/market-intelligence.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const productId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner"}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm"))return {rows:[{workspace_id:workspaceId,workspace_name:"Test workspace",role}]};
   if(sql.includes("FROM competitors"))return {rows:[]};
   if(sql.includes("INSERT INTO users"))return {rows:[{id:"local-user",email:"owner@example.test",status:"active"}]};
   return {rows:[]};
  },
  async connect(){
   return {
    async query(sql,values=[]){
     calls.push({sql,values});
     if(sql.includes("FROM workspaces WHERE"))return {rows:[{id:workspaceId}]};
     if(sql.includes("FROM workspace_members wm"))return {rows:[{role:"owner"}]};
     if(sql.includes("INSERT INTO competitors"))return {rows:[{id:"competitor-1",workspace_id:workspaceId,name:values[2]}]};
     return {rows:[]};
    },
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
  assert.equal(calls.length,0); // malformed resource IDs are rejected before membership lookup
 }finally{await app.close();}
});


test("invalid competitor identifiers are rejected before workspace membership lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/competitors/not-a-uuid`,payload:{name:"Cambio"}});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_COMPETITOR_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("invalid research identifiers are rejected before workspace membership lookup",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/researches/not-a-uuid/observations`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_RESEARCH_ID");
  assert.equal(calls.length,0);
 }finally{await app.close();}
});

test("viewer is denied every market-intelligence mutation before identity creation or persistence",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 const requests=[
  {method:"POST",url:`/api/v1/workspaces/${workspaceId}/competitors`,payload:{name:"Competidor"}},
  {method:"POST",url:`/api/v1/workspaces/${workspaceId}/products`,payload:{name:"Producto"}},
  {method:"POST",url:`/api/v1/workspaces/${workspaceId}/products/${productId}/prices`,payload:{price:12,currency:"USD",observedOn:"2026-11-07"}},
  {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`,payload:{name:"Cambio"}},
  {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`},
  {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`,payload:{name:"Cambio"}},
  {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`},
  {method:"POST",url:`/api/v1/workspaces/${workspaceId}/researches/${productId}/observations`,payload:{type:"risk",description:"Riesgo"}}
 ];
 try{
  for(const request of requests){
   const response=await app.inject(request);
   assert.equal(response.statusCode,403,request.method+" "+request.url);
   assert.equal(response.json().error,"FORBIDDEN");
  }
  assert.equal(calls.some(call=>/INSERT INTO users|INSERT INTO competitors|INSERT INTO market_products|INSERT INTO price_observations|UPDATE competitors|UPDATE market_products|INSERT INTO market_observations|UPDATE market_observations|DELETE FROM/.test(call.sql)),false);
  assert.equal(calls.some(call=>call.sql==="RELEASE"),false);
 }finally{await app.close();}
});

test("viewer can read products, price history, observations and market analysis",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 const urls=[
  `/api/v1/workspaces/${workspaceId}/products`,
  `/api/v1/workspaces/${workspaceId}/products/${productId}/prices`,
  `/api/v1/workspaces/${workspaceId}/researches/${productId}/observations`,
  `/api/v1/workspaces/${workspaceId}/researches/${productId}/analysis`
 ];
 try{
  for(const url of urls){
   const response=await app.inject({method:"GET",url});
   assert.equal(response.statusCode,200,url);
   if(url.endsWith("/analysis"))assert.equal(typeof response.json().data,"object");
   else assert.ok(Array.isArray(response.json().data),url);
  }
  assert.ok(calls.some(call=>call.sql.includes("FROM market_products")));
  assert.ok(calls.some(call=>call.sql.includes("FROM price_observations")));
  assert.ok(calls.some(call=>call.sql.includes("market_observations")));
 }finally{await app.close();}
});



test("foreign competitor and product IDs cannot be updated or archived across workspaces",async()=>{
 const {app,calls}=await buildApp();
 const requests=[
  {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`,payload:{name:"Cambio externo"},table:"competitors"},
  {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`,table:"competitors"},
  {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`,payload:{name:"Cambio externo"},table:"market_products"},
  {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`,table:"market_products"}
 ];
 try{
  for(const request of requests){
   const response=await app.inject({method:request.method,url:request.url,payload:request.payload});
   assert.equal(response.statusCode,404,request.method+" "+request.url);
   assert.equal(response.json().error,"NOT_FOUND");
  }
  for(const table of ["competitors","market_products"]){
   const mutations=calls.filter(call=>call.sql?.includes("UPDATE "+table));
   assert.ok(mutations.length>=2);
   for(const mutation of mutations){
    assert.deepEqual(mutation.values.slice(0,2),[workspaceId,productId]);
    assert.match(mutation.sql,/WHERE workspace_id=\$1 AND id=\$2 AND status='active'/);
   }
  }
  assert.equal(calls.some(call=>call.sql?.includes("INSERT INTO audit_logs")),false);
 }finally{await app.close();}
});


test("market-intelligence write permissions follow owner, admin, analyst and viewer roles",async()=>{
 for(const role of ["owner","admin","analyst","viewer"]){
  const {app,calls}=await buildApp({role});
  try{
   const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/competitors`,payload:{name:"Competidor de prueba"}});
   if(role==="viewer"){
    assert.equal(response.statusCode,403);
    assert.equal(response.json().error,"FORBIDDEN");
    assert.equal(calls.some(call=>call.sql?.includes("INSERT INTO users")||call.sql?.includes("INSERT INTO competitors")),false);
   }else{
    assert.equal(response.statusCode,201,role+" should create competitors");
    assert.ok(calls.some(call=>call.sql?.includes("INSERT INTO competitors")));
    assert.ok(calls.some(call=>call.sql?.includes("INSERT INTO audit_logs")));
   }
  }finally{await app.close();}
 }
});



test("competitor and product update/archive routes enforce writer permissions for every role",async()=>{
 for(const role of ["owner","admin","analyst","viewer"]){
  const {app,calls}=await buildApp({role});
  const requests=[
   {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`,payload:{name:"Cambio"}},
   {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/competitors/${productId}`},
   {method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`,payload:{name:"Cambio"}},
   {method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/products/${productId}`}
  ];
  try{
   for(const request of requests){
    const response=await app.inject(request);
    if(role==="viewer"){
     assert.equal(response.statusCode,403,request.method+" "+request.url);
     assert.equal(response.json().error,"FORBIDDEN");
    }else{
     assert.notEqual(response.statusCode,403,role+" "+request.method+" "+request.url);
    }
   }
   const mutations=calls.filter(call=>/UPDATE (competitors|market_products)/.test(call.sql||""));
   if(role==="viewer"){
    assert.equal(mutations.length,0);
    assert.equal(calls.some(call=>call.sql==="RELEASE"),false);
   }else{
    assert.equal(mutations.length,4);
    for(const mutation of mutations){
     assert.deepEqual(mutation.values.slice(0,2),[workspaceId,productId]);
     assert.match(mutation.sql,/WHERE workspace_id=\$1 AND id=\$2/);
    }
   }
  }finally{await app.close();}
 }
});



test("product, price and observation creation use the same owner/admin/analyst writer matrix",async()=>{
 for(const role of ["owner","admin","analyst","viewer"]){
  const {app,calls}=await buildApp({role});
  const requests=[
   {method:"POST",url:`/api/v1/workspaces/${workspaceId}/products`,payload:{name:"Producto de prueba"}},
   {method:"POST",url:`/api/v1/workspaces/${workspaceId}/products/${productId}/prices`,payload:{price:12.5,currency:"USD",observedOn:"2026-11-07"}},
   {method:"POST",url:`/api/v1/workspaces/${workspaceId}/researches/${productId}/observations`,payload:{type:"risk",title:"Riesgo",content:"Descripción del riesgo",observedOn:"2026-11-07"}}
  ];
  try{
   for(const request of requests){
    const response=await app.inject(request);
    if(role==="viewer"){
     assert.equal(response.statusCode,403,request.url);
     assert.equal(response.json().error,"FORBIDDEN");
    }else{
     assert.notEqual(response.statusCode,403,role+" "+request.url);
    }
   }
   const writes=calls.filter(call=>/INSERT INTO (market_products|price_observations|market_observations)/.test(call.sql||""));
   if(role==="viewer")assert.equal(writes.length,0);
   else{
    assert.equal(writes.length,3);
    for(const write of writes)assert.equal(write.values[0],workspaceId);
   }
  }finally{await app.close();}
 }
});
