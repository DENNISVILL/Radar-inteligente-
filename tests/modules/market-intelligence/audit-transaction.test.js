import test from "node:test";
import assert from "node:assert/strict";
import {executeAuditedMutation} from "../../../src/modules/market-intelligence/application/audit-transaction.js";

function poolFor(handler){
 const calls=[];
 const client={async query(sql,values){calls.push({sql,values});return handler(sql,values);},release(){calls.push({sql:"RELEASE"});}};
 return {calls,pool:{async connect(){return client;}}};
}
test("commits resource mutation and audit event on the same checked-out client",async()=>{
 const {calls,pool}=poolFor((sql)=>sql.includes("INSERT INTO audit_logs")?{rows:[]}:{rows:[]});
 const result=await executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",eventType:"market_product.created",resourceType:"market_product",metadata:{name:"Producto"}},async client=>{
  await client.query("INSERT INTO market_products ...");
  return {id:"p1",name:"Producto"};
 });
 assert.equal(result.id,"p1");
 assert.equal(calls[0].sql,"BEGIN");
 assert.equal(calls[1].sql,"INSERT INTO market_products ...");
 assert.match(calls[2].sql,/INSERT INTO audit_logs/);
 assert.deepEqual(calls[2].values,["w1","u1","market_product.created","market_product","p1",'{"name":"Producto"}']);
 assert.equal(calls[3].sql,"COMMIT");
 assert.equal(calls[4].sql,"RELEASE");
});
test("does not create audit entry if resource mutation returns no row",async()=>{
 const {calls,pool}=poolFor(()=>({rows:[]}));
 const result=await executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",eventType:"market_competitor.updated",resourceType:"competitor"},async()=>null);
 assert.equal(result,null);
 assert.equal(calls.filter(x=>/INSERT INTO audit_logs/.test(x.sql)).length,0);
 assert.equal(calls[1].sql,"COMMIT");
});
test("rolls back mutation when audit insertion fails",async()=>{
 const {calls,pool}=poolFor(sql=>{if(sql.includes("INSERT INTO audit_logs"))throw new Error("audit unavailable");return {rows:[]};});
 await assert.rejects(()=>executeAuditedMutation(pool,{workspaceId:"w1",actorUserId:"u1",eventType:"market_observation.created",resourceType:"market_observation"},async client=>{
  await client.query("INSERT INTO market_observations ...");return {id:"o1"};
 }),/audit unavailable/);
 assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
 assert.equal(calls.at(-1).sql,"RELEASE");
});
