import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
import {applyMigrations} from "../../scripts/migrate.js";
import {listWorkspaceAuditLogs,parseAuditCursor} from "../../src/modules/market-intelligence/application/workspace-audit-logs.js";

test("PostgreSQL audit history is workspace-scoped, keyset-paginated and reauthorizes current role",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const suffix=randomUUID();
 const slug="audit-pagination-"+suffix;
 const subject="audit-pagination-"+suffix;
 const email=subject+"@example.test";
 let workspaceId,userId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Audit pagination',$1) RETURNING id",[slug]);
  workspaceId=workspace.rows[0].id;
  const user=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[subject,email]);
  userId=user.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,userId]);
  for(let i=0;i<3;i++){
   await pool.query(
    "INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,metadata,created_at) VALUES($1,$2,$3,'test',$4::jsonb,$5::timestamptz)",
    [workspaceId,userId,"test.event."+i,JSON.stringify({index:i}),"2026-11-08T10:0"+i+":00.000Z"]
   );
  }
  const first=await listWorkspaceAuditLogs(pool,{workspaceId,authSubject:subject,limit:2});
  assert.equal(first.data.length,2);
  assert.ok(first.nextCursor);
  assert.equal(first.data[0].event_type,"test.event.2");
  const second=await listWorkspaceAuditLogs(pool,{workspaceId,authSubject:subject,limit:2,cursor:parseAuditCursor(first.nextCursor)});
  assert.equal(second.data.length,1);
  assert.equal(second.data[0].event_type,"test.event.0");
  assert.equal(second.nextCursor,null);

  await pool.query("UPDATE workspace_members SET role='viewer' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,userId]);
  const denied=await listWorkspaceAuditLogs(pool,{workspaceId,authSubject:subject,limit:2});
  assert.equal(denied.forbidden,true);
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]).catch(()=>{});
  if(userId)await pool.query("DELETE FROM users WHERE id=$1",[userId]).catch(()=>{});
  await pool.end();
 }
});
