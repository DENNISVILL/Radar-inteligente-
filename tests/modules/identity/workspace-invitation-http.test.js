import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import Fastify from "fastify";
import {workspaceInvitationRoutes} from "../../../src/modules/identity/presentation/workspace-invitation.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const invitationId="22222222-2222-4222-8222-222222222222";
const rawToken="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const invite={id:invitationId,workspace_id:workspaceId,email:"new@example.test",role:"analyst",expires_at:new Date(Date.now()+86400000),accepted_at:null,revoked_at:null};

async function buildApp({role="owner",email="new@example.test",member=true}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("FROM workspace_members wm"))return {rows:member?[{workspace_id:workspaceId,role}]:[]};
   if(sql.includes("INSERT INTO users (auth_subject, email)"))return {rows:[{id:"owner-user",email,status:"active"}]};
   return {rows:[]};
  },
  async connect(){
   return {async query(sql,values=[]){
    calls.push({sql,values});
    if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:workspaceId}]};
    if(sql.includes("INSERT INTO workspace_invitations"))return {rows:[{id:invitationId,email:"new@example.test",role:"analyst",expires_at:invite.expires_at,created_at:new Date()}]};
    if(sql.includes("FROM workspace_invitations WHERE token_hash"))return {rows:[invite]};
    if(sql.includes("INSERT INTO users(auth_subject,email)"))return {rows:[{id:"invitee-user",status:"active"}]};
    if(sql.includes("INSERT INTO workspace_members"))return {rows:[{workspace_id:workspaceId,user_id:"invitee-user",role:"analyst"}]};
    if(sql.includes("UPDATE workspace_invitations SET revoked_at"))return {rows:[{id:invitationId,email:"new@example.test",role:"analyst"}]};
    return {rows:[]};
   },release(){calls.push({sql:"RELEASE",values:[]});}};
  }
 };
 const app=Fastify({logger:false});
 await app.register(workspaceInvitationRoutes,{database,requireIdentity:async request=>{request.identity={subject:"auth-user",email};}});
 await app.ready();
 return {app,calls};
}

test("HTTP create returns a one-time token only to an authorized workspace manager",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/invitations`,payload:{email:"new@example.test",role:"analyst"}});
  assert.equal(response.statusCode,201);
  assert.equal(response.json().data.email,"new@example.test");
  assert.equal(typeof response.json().data.token,"string");
  assert.ok(!calls.some(call=>call.values?.includes(response.json().data.token)));
 }finally{await app.close();}
});

test("HTTP invitation creation rejects a non-manager before issuing a token",async()=>{
 const {app,calls}=await buildApp({role:"viewer"});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/invitations`,payload:{email:"new@example.test",role:"viewer"}});
  assert.equal(response.statusCode,403);
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO workspace_invitations")).length,0);
 }finally{await app.close();}
});

test("HTTP acceptance binds the one-time token to the authenticated email",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"POST",url:"/api/v1/invitations/accept",payload:{token:rawToken}});
  assert.equal(response.statusCode,200);
  assert.equal(response.json().data.accepted,true);
  const hash=calls.find(call=>call.sql?.includes("FROM workspace_invitations WHERE token_hash")).values[0];
  assert.equal(hash,createHash("sha256").update(rawToken).digest("hex"));
 }finally{await app.close();}
});

test("HTTP acceptance rejects a different authenticated email without creating a local user",async()=>{
 const {app,calls}=await buildApp({email:"someone-else@example.test"});
 try{
  const response=await app.inject({method:"POST",url:"/api/v1/invitations/accept",payload:{token:rawToken}});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"INVITATION_EMAIL_MISMATCH");
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO users(auth_subject,email)")).length,0);
 }finally{await app.close();}
});

test("HTTP listing exposes only pending invitations to workspace managers",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/invitations`});
  assert.equal(response.statusCode,200);
  assert.ok(Array.isArray(response.json().data));
  const query=calls.find(call=>call.sql?.includes("FROM workspace_invitations")&&call.sql.includes("accepted_at IS NULL"));
  assert.ok(query);
  assert.match(query.sql,/revoked_at IS NULL/);
  assert.match(query.sql,/expires_at>NOW\(\)/);
 }finally{await app.close();}
});

test("HTTP listing rejects members without invitation-management privileges",async()=>{
 const {app,calls}=await buildApp({role:"analyst"});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/invitations`});
  assert.equal(response.statusCode,403);
  assert.equal(calls.filter(call=>call.sql?.includes("FROM workspace_invitations")).length,0);
 }finally{await app.close();}
});

test("HTTP revocation validates the invitation identifier before touching storage",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/invitations/not-a-uuid`});
  assert.equal(response.statusCode,400);
  assert.equal(response.json().error,"INVALID_INVITATION_ID");
  assert.equal(calls.filter(call=>call.sql?.includes("UPDATE workspace_invitations")).length,0);
 }finally{await app.close();}
});

test("HTTP revocation is available to managers and returns a revoked state",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`});
  assert.equal(response.statusCode,200);
  assert.deepEqual(response.json().data,{id:invitationId,revoked:true});
  assert.ok(calls.some(call=>call.sql?.includes("workspace_invitation.revoked")));
 }finally{await app.close();}
});
