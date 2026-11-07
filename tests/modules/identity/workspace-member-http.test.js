import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {workspaceMemberRoutes} from "../../../src/modules/identity/presentation/workspace-member.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const userId="22222222-2222-4222-8222-222222222222";

async function buildApp({role="owner",memberRole="analyst",member=true,owners=2}={}){
 const calls=[];
 const database={
  async query(sql,values=[]){
   calls.push({sql,values});
   if(sql.includes("JOIN workspaces w"))return {rows:member?[{workspace_id:workspaceId,workspace_name:"Test workspace",role}]:[]};
   if(sql.includes("JOIN users u")&&sql.includes("joined_at"))return {rows:[{user_id:userId,email:"person@example.test",display_name:"Person",role:memberRole,joined_at:new Date()}]};
   return {rows:[]};
  },
  async connect(){
   return {
    async query(sql,values=[]){
     calls.push({sql,values});
     if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:workspaceId}]};
     if(sql.includes("SELECT id,email,display_name,status FROM users"))return {rows:[{id:userId,email:"person@example.test",display_name:"Person",status:"active"}]};
     if(sql.includes("SELECT role FROM workspace_members"))return {rows:[{role:memberRole}]};
     if(sql.includes("COUNT(*)::int"))return {rows:[{total:owners}]};
     if(sql.includes("INSERT INTO workspace_members"))return {rows:[{workspace_id:workspaceId,user_id:userId,role:"analyst",created_at:new Date()}]};
     if(sql.includes("UPDATE workspace_members SET role"))return {rows:[{workspace_id:workspaceId,user_id:userId,role:"viewer",created_at:new Date()}]};
     return {rows:[]};
    },
    release(){calls.push({sql:"RELEASE",values:[]});}
   };
  }
 };
 const app=Fastify({logger:false});
 await app.register(workspaceMemberRoutes,{database,requireIdentity:async request=>{request.identity={subject:"auth-owner",email:"owner@example.test"};}});
 await app.ready();
 return {app,calls};
}

test("HTTP member listing returns workspace-scoped active members for managers",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/members`});
  assert.equal(response.statusCode,200);
  assert.equal(response.json().data[0].user_id,userId);
  assert.ok(calls.some(call=>call.sql?.includes("joined_at")));
 }finally{await app.close();}
});

test("HTTP member listing denies analysts before querying member details",async()=>{
 const {app,calls}=await buildApp({role:"analyst"});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/members`});
  assert.equal(response.statusCode,403);
  assert.equal(calls.filter(call=>call.sql?.includes("joined_at")).length,0);
 }finally{await app.close();}
});

test("HTTP add-member endpoint validates and creates an existing account membership",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/members`,payload:{email:"person@example.test",role:"analyst"}});
  assert.equal(response.statusCode,201);
  assert.equal(response.json().data.user_id,userId);
  assert.ok(calls.some(call=>call.sql?.includes("workspace_member.added")));
 }finally{await app.close();}
});

test("HTTP add-member endpoint blocks admins from granting admin role",async()=>{
 const {app,calls}=await buildApp({role:"admin"});
 try{
  const response=await app.inject({method:"POST",url:`/api/v1/workspaces/${workspaceId}/members`,payload:{email:"person@example.test",role:"admin"}});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN_ROLE");
  assert.equal(calls.filter(call=>call.sql?.includes("INSERT INTO workspace_members")).length,0);
 }finally{await app.close();}
});

test("HTTP role changes persist and return the new member role",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"PATCH",url:`/api/v1/workspaces/${workspaceId}/members/${userId}`,payload:{role:"viewer"}});
  assert.equal(response.statusCode,200);
  assert.equal(response.json().data.role,"viewer");
  assert.ok(calls.some(call=>call.sql?.includes("workspace_member.role_changed")));
 }finally{await app.close();}
});

test("HTTP member removal records an audit event",async()=>{
 const {app,calls}=await buildApp();
 try{
  const response=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/members/${userId}`});
  assert.equal(response.statusCode,200);
  assert.deepEqual(response.json().data,{workspaceId,userId,removed:true});
  assert.ok(calls.some(call=>call.sql?.includes("workspace_member.removed")));
 }finally{await app.close();}
});

test("HTTP member removal cannot remove the last owner",async()=>{
 const {app,calls}=await buildApp({memberRole:"owner",owners:1});
 try{
  const response=await app.inject({method:"DELETE",url:`/api/v1/workspaces/${workspaceId}/members/${userId}`});
  assert.equal(response.statusCode,409);
  assert.equal(response.json().error,"LAST_OWNER");
  assert.ok(calls.some(call=>call.sql==="ROLLBACK"));
 }finally{await app.close();}
});
