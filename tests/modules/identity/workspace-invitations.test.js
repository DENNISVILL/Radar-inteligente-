import test from "node:test";
import assert from "node:assert/strict";
import {
 acceptWorkspaceInvitation,createWorkspaceInvitation,listWorkspaceInvitations,revokeWorkspaceInvitation
} from "../../../src/modules/identity/application/workspace-invitations.js";

function setup(handler){
 const calls=[];
 const client={async query(sql,values=[]){calls.push({sql,values});return handler(sql,values);},release(){calls.push({sql:"RELEASE"});}};
 return {calls,database:{async connect(){return client;},async query(sql,values=[]){calls.push({sql,values});return handler(sql,values);}}};
}
const invitation={id:"invite-1",workspace_id:"workspace-1",email:"new@example.test",role:"analyst",expires_at:new Date(Date.now()+86400000),accepted_at:null,revoked_at:null};
const token="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

test("creates an invitation with a one-time token and stores only its SHA-256 hash",async()=>{
 const {calls,database}=setup(sql=>{
  if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"workspace-1"}]};
  if(sql.includes("INSERT INTO workspace_invitations"))return {rows:[{id:"invite-1",email:"new@example.test",role:"analyst",expires_at:invitation.expires_at,created_at:new Date()}]};
  return {rows:[]};
 });
 const result=await createWorkspaceInvitation(database,{workspaceId:"workspace-1",email:" New@Example.Test ",role:"analyst",actorRole:"owner",actorUserId:"owner-1"});
 assert.equal(result.email,"new@example.test");
 assert.equal(typeof result.token,"string");
 assert.ok(!calls.some(call=>call.values?.includes(result.token)),"raw token must never be persisted");
 assert.match(calls.find(call=>call.sql.includes("INSERT INTO workspace_invitations")).values[3],/^[a-f0-9]{64}$/);
 assert.ok(calls.some(call=>call.sql.includes("INSERT INTO audit_logs")));
 assert.ok(calls.some(call=>call.sql==="COMMIT"));
});

test("admins cannot invite another administrator",async()=>{
 const result=await createWorkspaceInvitation({}, {workspaceId:"w",email:"a@example.test",role:"admin",actorRole:"admin",actorUserId:"u"});
 assert.equal(result.error,"FORBIDDEN_ROLE");
});

test("lists only active invitations without exposing token hashes",async()=>{
 const {database}=setup(sql=>{
  assert.match(sql,/accepted_at IS NULL/);
  assert.match(sql,/revoked_at IS NULL/);
  assert.doesNotMatch(sql,/token_hash/);
  return {rows:[{id:"invite-1",email:"new@example.test",role:"viewer"}]};
 });
 const rows=await listWorkspaceInvitations(database,"workspace-1");
 assert.equal(rows.length,1);
});

test("accepts an unexpired invitation only for the invited email and writes membership plus audit atomically",async()=>{
 const {calls,database}=setup(sql=>{
  if(sql.includes("FROM workspace_invitations WHERE token_hash"))return {rows:[invitation]};
  if(sql.includes("INSERT INTO users(auth_subject,email)"))return {rows:[{id:"user-1",status:"active"}]};
  if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"workspace-1"}]};
  if(sql.includes("INSERT INTO workspace_members"))return {rows:[{workspace_id:"workspace-1",user_id:"user-1",role:"analyst"}]};
  return {rows:[]};
 });
 const result=await acceptWorkspaceInvitation(database,{token,identity:{subject:"auth-user-1",email:"NEW@example.test"}});
 assert.equal(result.accepted,true);
 assert.equal(result.role,"analyst");
 assert.ok(calls.some(call=>call.sql.includes("UPDATE workspace_invitations SET accepted_at")));
 assert.ok(calls.some(call=>call.sql.includes("INSERT INTO audit_logs")));
 assert.equal(calls.at(-2).sql,"COMMIT");
 const hash=calls.find(call=>call.sql.includes("FROM workspace_invitations WHERE token_hash")).values[0];
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.notEqual(hash,token);
});

test("rejects an invitation when the authenticated email does not match",async()=>{
 const {calls,database}=setup(sql=>sql.includes("FROM workspace_invitations WHERE token_hash")?{rows:[invitation]}:{rows:[]});
 const result=await acceptWorkspaceInvitation(database,{token,identity:{subject:"auth-attacker",email:"attacker@example.test"}});
 assert.equal(result.error,"INVITATION_EMAIL_MISMATCH");
 assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
 assert.ok(!calls.some(call=>call.sql.includes("INSERT INTO workspace_members")));
});

test("rejects expired, revoked and previously accepted invitations",async t=>{
 for(const [name,patch,expected] of [
  ["expired",{expires_at:new Date(Date.now()-1000)},"INVITATION_EXPIRED"],
  ["revoked",{revoked_at:new Date()},"INVITATION_REVOKED"],
  ["used",{accepted_at:new Date()},"INVITATION_ALREADY_USED"]
 ]){
  await t.test(name,async()=>{
   const {database}=setup(sql=>sql.includes("FROM workspace_invitations WHERE token_hash")?{rows:[{...invitation,...patch}]}:{rows:[]});
   const result=await acceptWorkspaceInvitation(database,{token,userId:"user-1",email:"new@example.test"});
   assert.equal(result.error,expected);
  });
 }
});

test("revokes a pending invitation and records an audit event",async()=>{
 const {calls,database}=setup(sql=>sql.includes("UPDATE workspace_invitations SET revoked_at")?{rows:[{id:"invite-1",email:"new@example.test",role:"viewer"}]}:{rows:[]});
 const result=await revokeWorkspaceInvitation(database,{workspaceId:"workspace-1",invitationId:"invite-1",actorUserId:"owner-1"});
 assert.deepEqual(result,{id:"invite-1",revoked:true});
 assert.ok(calls.some(call=>call.sql.includes("INSERT INTO audit_logs")));
 assert.ok(calls.some(call=>call.sql==="COMMIT"));
});
