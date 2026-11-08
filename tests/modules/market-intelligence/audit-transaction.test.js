import test from "node:test";
import assert from "node:assert/strict";
import {executeAuditedMutation} from "../../../src/modules/market-intelligence/application/audit-transaction.js";

function poolFor(handler){
 const calls=[];
 const client={async query(sql,values){calls.push({sql,values});if(sql.includes("FROM workspaces WHERE"))return {rows:[{id:"w1"}]};if(sql.includes("FROM workspace_members wm"))return {rows:[{role:"owner"}]};return handler(sql,values);},release(){calls.push({sql:"RELEASE"});}};
 return {calls,pool:{async connect(){return client;}}};
}
test("commits resource mutation and audit event on the same checked-out client",async()=>{
 const {calls,pool}=poolFor((sql)=>sql.includes("INSERT INTO audit_logs")?{rows:[]}:{rows:[]});
 const result=await executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",actorSubject:"auth-u1",eventType:"market_product.created",resourceType:"market_product",metadata:{name:"Producto"}},async client=>{
  await client.query("INSERT INTO market_products ...");
  return {id:"p1",name:"Producto"};
 });
 assert.equal(result.id,"p1");
 assert.equal(calls[0].sql,"BEGIN");
 assert.equal(calls[1].sql,"SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE");
 assert.deepEqual(calls[1].values,["w1"]);
 assert.match(calls[2].sql,/FROM workspace_members wm/);
 assert.deepEqual(calls[2].values,["w1","auth-u1","u1"]);
 assert.equal(calls[3].sql,"INSERT INTO market_products ...");
 assert.match(calls[4].sql,/INSERT INTO audit_logs/);
 assert.deepEqual(calls[4].values,["w1","u1","market_product.created","market_product","p1",'{"name":"Producto"}']);
 assert.equal(calls[5].sql,"COMMIT");
 assert.equal(calls[6].sql,"RELEASE");
});
test("does not create audit entry if resource mutation returns no row",async()=>{
 const {calls,pool}=poolFor(()=>({rows:[]}));
 const result=await executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",actorSubject:"auth-u1",eventType:"market_competitor.updated",resourceType:"competitor"},async()=>null);
 assert.equal(result,null);
 assert.equal(calls.filter(x=>/INSERT INTO audit_logs/.test(x.sql)).length,0);
 assert.equal(calls.at(-2).sql,"COMMIT");
});
test("rolls back mutation when audit insertion fails",async()=>{
 const {calls,pool}=poolFor(sql=>{if(sql.includes("INSERT INTO audit_logs"))throw new Error("audit unavailable");return {rows:[]};});
 await assert.rejects(()=>executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",actorSubject:"auth-u1",eventType:"market_observation.created",resourceType:"market_observation"},async client=>{
  await client.query("INSERT INTO market_observations ...");return {id:"o1"};
 }),/audit unavailable/);
 assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
 assert.equal(calls.at(-1).sql,"RELEASE");
});


test("rejects a member whose role was downgraded before the write transaction",async()=>{
 const calls=[];
 const client={
  async query(sql,values){
   calls.push({sql,values});
   if(sql.includes("FROM workspaces WHERE"))return {rows:[{id:"w1"}]};
   if(sql.includes("FROM workspace_members wm"))return {rows:[{role:"viewer"}]};
   return {rows:[]};
  },
  release(){calls.push({sql:"RELEASE"});}
 };
 const pool={async connect(){return client;}};
 let mutated=false;
 await assert.rejects(
  ()=>executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",actorSubject:"auth-u1",eventType:"test",resourceType:"test"},async()=>{mutated=true;return {id:"r1"};}),
  error=>error.statusCode===403&&error.code==="WORKSPACE_ACCESS_REVOKED"
 );
 assert.equal(mutated,false);
 assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
 assert.equal(calls.some(call=>call.sql==="COMMIT"),false);
});

test("rejects a membership revoked before the write transaction without running mutation",async()=>{
 const calls=[];
 const client={
  async query(sql,values){
   calls.push({sql,values});
   if(sql.includes("FROM workspaces WHERE"))return {rows:[{id:"w1"}]};
   if(sql.includes("FROM workspace_members wm"))return {rows:[]};
   return {rows:[]};
  },
  release(){calls.push({sql:"RELEASE"});}
 };
 const pool={async connect(){return client;}};
 let mutated=false;
 await assert.rejects(
  ()=>executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",actorSubject:"auth-u1",eventType:"test",resourceType:"test"},async()=>{mutated=true;return {id:"r1"};}),
  error=>error.statusCode===403&&error.code==="WORKSPACE_ACCESS_REVOKED"
 );
 assert.equal(mutated,false);
 assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
});
