import test from "node:test";
import assert from "node:assert/strict";
import {encodeAuditCursor,listWorkspaceAuditLogs,parseAuditCursor} from "../../../src/modules/market-intelligence/application/workspace-audit-logs.js";

function makePool({role="owner",workspace=true,rows=[]}={}){
 const calls=[];
 const client={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspaces WHERE"))return {rows:workspace?[{id:"w1"}]:[]};
   if(sql.includes("FROM workspace_members wm"))return {rows:role?[{role}]:[]};
   if(sql.includes("FROM audit_logs"))return {rows};
   return {rows:[]};
  },
  release(){calls.push({sql:"RELEASE"});}
 };
 return {calls,pool:{async connect(){return client;}}};
}

test("audit reads lock workspace then membership before querying logs and commit atomically",async()=>{
 const {calls,pool}=makePool({rows:[]});
 const result=await listWorkspaceAuditLogs(pool,{workspaceId:"w1",authSubject:"auth-u1"});
 assert.deepEqual(result,{data:[],nextCursor:null});
 assert.equal(calls[0].sql,"BEGIN");
 assert.match(calls[1].sql,/FROM workspaces WHERE id=\$1 AND status='active' FOR UPDATE/);
 assert.match(calls[2].sql,/FROM workspace_members wm[\s\S]*FOR UPDATE OF wm/);
 assert.match(calls[3].sql,/FROM audit_logs/);
 assert.deepEqual(calls[3].values,["w1",null,null,51]);
 assert.equal(calls[4].sql,"COMMIT");
 assert.equal(calls[5].sql,"RELEASE");
});

test("only owner and admin can query audit entries",async()=>{
 for(const role of ["analyst","viewer",null]){
  const {calls,pool}=makePool({role});
  const result=await listWorkspaceAuditLogs(pool,{workspaceId:"w1",authSubject:"auth-u1"});
  assert.equal(result.forbidden,true, String(role));
  assert.equal(calls.some(call=>call.sql.includes("FROM audit_logs")),false);
  assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
 }
});

test("inactive or removed workspace is denied before membership or audit query",async()=>{
 const {calls,pool}=makePool({workspace:false});
 const result=await listWorkspaceAuditLogs(pool,{workspaceId:"w1",authSubject:"auth-u1"});
 assert.equal(result.forbidden,true);
 assert.equal(calls.some(call=>call.sql.includes("FROM workspace_members wm")),false);
 assert.equal(calls.some(call=>call.sql.includes("FROM audit_logs")),false);
});

test("audit log pagination uses a stable created_at and id keyset cursor",async()=>{
 const rows=[
  {id:"11111111-1111-4111-8111-111111111111",created_at:"2026-11-08T10:00:00.000Z"},
  {id:"22222222-2222-4222-8222-222222222222",created_at:"2026-11-08T09:00:00.000Z"},
  {id:"33333333-3333-4333-8333-333333333333",created_at:"2026-11-08T08:00:00.000Z"}
 ];
 const {calls,pool}=makePool({rows});
 const result=await listWorkspaceAuditLogs(pool,{workspaceId:"w1",authSubject:"auth-u1",limit:2});
 assert.equal(result.data.length,2);
 assert.equal(result.nextCursor,encodeAuditCursor(rows[1]));
 const query=calls.find(call=>call.sql.includes("FROM audit_logs"));
 assert.match(query.sql,/\(created_at,id\)<\(\$2::timestamptz,\$3::uuid\)/);
 assert.equal(query.values[3],3);
});

test("cursor parser rejects malformed, oversized, invalid-date and invalid-id cursors",()=>{
 for(const value of ["not-base64","", "x".repeat(513),Buffer.from(JSON.stringify({createdAt:"bad",id:"11111111-1111-4111-8111-111111111111"})).toString("base64url"),Buffer.from(JSON.stringify({createdAt:"2026-11-08T00:00:00Z",id:"bad"})).toString("base64url")]){
  assert.equal(parseAuditCursor(value),undefined);
 }
 assert.equal(parseAuditCursor(undefined),null);
});

test("cursor parser normalizes a valid timestamp and retains the stable UUID",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 const value=Buffer.from(JSON.stringify({createdAt:"2026-11-08T10:00:00Z",id})).toString("base64url");
 assert.deepEqual(parseAuditCursor(value),{createdAt:"2026-11-08T10:00:00.000Z",id});
});
