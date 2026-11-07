import test from "node:test";
import assert from "node:assert/strict";
import {addWorkspaceMember,removeWorkspaceMember,updateWorkspaceMemberRole} from "../../../src/modules/identity/application/workspace-members.js";
function setup(handler){const calls=[];const client={async query(sql,values=[]){calls.push({sql,values});return handler(sql,values);},release(){calls.push({sql:"RELEASE"});}};return {calls,database:{async connect(){return client;}}};}
test("adds an existing active user and audits the membership in one transaction",async()=>{
 const {calls,database}=setup(sql=>{if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"w"}]};if(sql.includes("SELECT id,email"))return {rows:[{id:"u2",email:"person@example.test",display_name:"Person",status:"active"}]};if(sql.includes("INSERT INTO workspace_members"))return {rows:[{workspace_id:"w",user_id:"u2",role:"analyst"}]};return {rows:[]};});
 const result=await addWorkspaceMember(database,{workspaceId:"w",email:"person@example.test",role:"analyst",actorRole:"owner",actorSubject:"auth-owner"});
 assert.equal(result.user_id,"u2");assert.ok(calls.some(x=>x.sql.includes("INSERT INTO audit_logs")));assert.equal(calls.at(-2).sql,"COMMIT");
});
test("does not allow admins to grant admin role",async()=>{assert.equal((await addWorkspaceMember({}, {workspaceId:"w",email:"a@b.com",role:"admin",actorRole:"admin"})).error,"FORBIDDEN_ROLE");});
test("prevents demoting the last owner",async()=>{
 const {calls,database}=setup(sql=>{if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"w"}]};if(sql.includes("SELECT role FROM workspace_members"))return {rows:[{role:"owner"}]};if(sql.includes("COUNT(*)::int"))return {rows:[{total:1}]};return {rows:[]};});
 assert.equal((await updateWorkspaceMemberRole(database,{workspaceId:"w",userId:"u1",role:"viewer",actorRole:"owner",actorSubject:"auth-owner"})).error,"LAST_OWNER");assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
});
test("prevents admins from modifying an owner's role",async()=>{
 const {calls,database}=setup(sql=>{if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"w"}]};if(sql.includes("SELECT role FROM workspace_members"))return {rows:[{role:"owner"}]};return {rows:[]};});
 assert.equal((await updateWorkspaceMemberRole(database,{workspaceId:"w",userId:"u1",role:"viewer",actorRole:"admin",actorSubject:"auth-admin"})).error,"FORBIDDEN_ROLE");assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
});
test("prevents removing the last owner",async()=>{
 const {calls,database}=setup(sql=>{if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"w"}]};if(sql.includes("SELECT role FROM workspace_members"))return {rows:[{role:"owner"}]};if(sql.includes("COUNT(*)::int"))return {rows:[{total:1}]};return {rows:[]};});
 assert.equal((await removeWorkspaceMember(database,{workspaceId:"w",userId:"u1",actorRole:"owner",actorSubject:"auth-owner"})).error,"LAST_OWNER");assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
});
test("rolls back if membership audit insertion fails",async()=>{
 const {calls,database}=setup(sql=>{if(sql.includes("SELECT id FROM workspaces"))return {rows:[{id:"w"}]};if(sql.includes("SELECT id,email"))return {rows:[{id:"u2",email:"person@example.test",status:"active"}]};if(sql.includes("INSERT INTO workspace_members"))return {rows:[{workspace_id:"w",user_id:"u2",role:"viewer"}]};if(sql.includes("INSERT INTO audit_logs"))throw new Error("audit failure");return {rows:[]};});
 await assert.rejects(()=>addWorkspaceMember(database,{workspaceId:"w",email:"person@example.test",role:"viewer",actorRole:"owner",actorSubject:"auth-owner"}),/audit failure/);assert.ok(calls.some(x=>x.sql==="ROLLBACK"));
});
