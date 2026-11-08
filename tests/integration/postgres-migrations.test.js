import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {applyMigrations} from "../../scripts/migrate.js";

test("PostgreSQL migrations are executable, repeatable and enforce tenant relations",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 let workspaceA,workspaceB,userId,auditId;
 try{
  const first=await applyMigrations(pool);
  assert.equal(first.discovered,11);
  const second=await applyMigrations(pool);
  assert.deepEqual(second.versions,first.versions);
  const tables=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()");
  const names=new Set(tables.rows.map(row=>row.tablename));
  for(const name of ["workspaces","users","workspace_members","researches","competitors","market_products","price_observations","market_observations","market_reports","audit_logs","workspace_invitations","schema_migrations"])assert.ok(names.has(name),`missing table ${name}`);
  const a=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Integration A',$1) RETURNING id",[`integration-a-${Date.now()}`]);
  workspaceA=a.rows[0].id;
  const b=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Integration B',$1) RETURNING id",[`integration-b-${Date.now()}`]);
  workspaceB=b.rows[0].id;
  const user=await pool.query("INSERT INTO users(auth_subject,email,display_name) VALUES($1,$2,'CI integration') RETURNING id",[`ci-${Date.now()}`,`ci-${Date.now()}@example.test`]);
  userId=user.rows[0].id;
  const research=await pool.query("INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Research','Ecuador','Retail','Test') RETURNING id",[workspaceA,userId]);
  const competitor=await pool.query("INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Competitor A') RETURNING id",[workspaceA,userId]);
  const researchB=await pool.query("INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Research B','Ecuador','Retail','Cross tenant test') RETURNING id",[workspaceB,userId]);
  const competitorB=await pool.query("INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Competitor B') RETURNING id",[workspaceB,userId]);
  await assert.rejects(()=>pool.query("INSERT INTO market_products(workspace_id,competitor_id,name) VALUES($1,$2,'Cross tenant product')",[workspaceB,competitor.rows[0].id]),/foreign key/i);
  await assert.rejects(()=>pool.query("INSERT INTO market_observations(workspace_id,research_id,competitor_id,observation_type,title,content,observed_on) VALUES($1,$2,$3,'risk','Cross tenant','Must be rejected','2026-11-07')",[workspaceA,research.rows[0].id,competitorB.rows[0].id]),/foreign key/i);
  await assert.rejects(()=>pool.query("INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by) VALUES($1,$2,1,'{}'::jsonb,$3)",[workspaceB,research.rows[0].id,userId]),/foreign key/i);
  assert.ok(researchB.rows[0].id);
  await assert.rejects(()=>pool.query("INSERT INTO market_products(workspace_id,research_id,name) VALUES($1,$2,'Cross tenant research product')",[workspaceA,researchB.rows[0].id]),/foreign key/i);
  await assert.rejects(()=>pool.query("INSERT INTO market_observations(workspace_id,research_id,competitor_id,observation_type,title,content,observed_on) VALUES($1,$2,$3,'risk','Cross tenant research','Must be rejected','2026-11-07')",[workspaceB,researchB.rows[0].id,competitor.rows[0].id]),/foreign key/i);
  const product=await pool.query("INSERT INTO market_products(workspace_id,competitor_id,research_id,created_by,name) VALUES($1,$2,$3,$4,'Product A') RETURNING id",[workspaceA,competitor.rows[0].id,research.rows[0].id,userId]);
  await pool.query("INSERT INTO price_observations(workspace_id,product_id,recorded_by,price,currency,observed_on) VALUES($1,$2,$3,12.50,'USD','2026-11-07')",[workspaceA,product.rows[0].id,userId]);
  await assert.rejects(()=>pool.query("INSERT INTO price_observations(workspace_id,product_id,recorded_by,price,currency,observed_on) VALUES($1,$2,$3,99.00,'USD','2026-11-07')",[workspaceB,product.rows[0].id,userId]),/foreign key/i);
  const history=await pool.query("SELECT count(*)::int AS count FROM price_observations WHERE workspace_id=$1 AND product_id=$2",[workspaceA,product.rows[0].id]);
  assert.equal(history.rows[0].count,1);
  const snapshot=await pool.query("INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by) VALUES($1,$2,1,$3::jsonb,$4) RETURNING id,report_hash",[workspaceA,research.rows[0].id,JSON.stringify({title:"Snapshot de integración"}),userId]);
  assert.match(snapshot.rows[0].report_hash,/^[0-9a-f]{64}$/);
  const integrity=await pool.query("SELECT encode(digest(report_data::text,'sha256'),'hex')=report_hash AS verified FROM market_reports WHERE id=$1",[snapshot.rows[0].id]);
  assert.equal(integrity.rows[0].verified,true);
  await assert.rejects(()=>pool.query("UPDATE market_reports SET report_data='{}'::jsonb WHERE id=$1",[snapshot.rows[0].id]),/immutable/i);
  const membership=await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceA,userId]);
  assert.equal(membership.rowCount,1);
  const audit=await pool.query("INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'integration.created','workspace',$1,$3::jsonb) RETURNING id",[workspaceA,userId,JSON.stringify({source:"migration-test"})]);
  auditId=audit.rows[0].id;
  await assert.rejects(()=>pool.query("UPDATE audit_logs SET metadata='{}'::jsonb WHERE id=$1",[auditId]),/immutable/i);
  await assert.rejects(()=>pool.query("DELETE FROM audit_logs WHERE id=$1",[auditId]),/immutable/i);
  await assert.rejects(()=>pool.query("TRUNCATE audit_logs"),/immutable/i);
  await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceA]);
  workspaceA=null;
  const retained=await pool.query("SELECT workspace_id,actor_user_id,event_type,metadata FROM audit_logs WHERE id=$1",[auditId]);
  assert.equal(retained.rows[0].workspace_id,null);
  assert.equal(retained.rows[0].actor_user_id,userId);
  assert.equal(retained.rows[0].event_type,"integration.created");
  assert.deepEqual(retained.rows[0].metadata,{source:"migration-test"});
  await pool.query("DELETE FROM users WHERE id=$1",[userId]);
  userId=null;
  const afterActorRemoval=await pool.query("SELECT actor_user_id FROM audit_logs WHERE id=$1",[auditId]);
  assert.equal(afterActorRemoval.rows[0].actor_user_id,null);
 }finally{
  if(workspaceA)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceA]);
  if(workspaceB)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceB]);
  if(userId)await pool.query("DELETE FROM users WHERE id=$1",[userId]);
  await pool.end();
 }
});

test("PostgreSQL accepts a workspace invitation only once under concurrent requests",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const {createHash,randomUUID}=await import("node:crypto");
 const {acceptWorkspaceInvitation}=await import("../../src/modules/identity/application/workspace-invitations.js");
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const suffix=randomUUID();
 const authSubject=`ci-inviter-${suffix}`;
 const invitedEmail=`invitee-${suffix}@example.test`;
 const token=`concurrency-${suffix}-one-time-token`;
 let workspaceId,inviterId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Invitation concurrency',$1) RETURNING id",[`invite-concurrency-${suffix}`]);
  workspaceId=workspace.rows[0].id;
  const inviter=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[authSubject,`inviter-${suffix}@example.test`]);
  inviterId=inviter.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,inviterId]);
  const tokenHash=createHash("sha256").update(token,"utf8").digest("hex");
  await pool.query("INSERT INTO workspace_invitations(workspace_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,'analyst',$3,$4,NOW()+INTERVAL '1 day')",[workspaceId,invitedEmail,tokenHash,inviterId]);
  const [first,second]=await Promise.all([
   acceptWorkspaceInvitation(pool,{token,identity:{subject:`invitee-a-${suffix}`,email:invitedEmail}}),
   acceptWorkspaceInvitation(pool,{token,identity:{subject:`invitee-b-${suffix}`,email:invitedEmail}})
  ]);
  const outcomes=[first,second];
  assert.equal(outcomes.filter(result=>result.accepted===true).length,1);
  assert.equal(outcomes.filter(result=>result.error==="INVITATION_ALREADY_USED").length,1);
  const membership=await pool.query("SELECT count(*)::int AS count FROM workspace_members WHERE workspace_id=$1 AND role='analyst'",[workspaceId]);
  assert.equal(membership.rows[0].count,1);
  const invitation=await pool.query("SELECT accepted_at FROM workspace_invitations WHERE token_hash=$1",[tokenHash]);
  assert.ok(invitation.rows[0].accepted_at);
  const audit=await pool.query("SELECT count(*)::int AS count FROM audit_logs WHERE workspace_id=$1 AND event_type='workspace_invitation.accepted'",[workspaceId]);
  assert.equal(audit.rows[0].count,1);
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]);
  await pool.query("DELETE FROM users WHERE auth_subject LIKE $1",[ `invitee-%-${suffix}` ]).catch(()=>{});
  if(inviterId)await pool.query("DELETE FROM users WHERE id=$1",[inviterId]);
  await pool.end();
 }
});

test("PostgreSQL persists, lists, rejects duplicates and revokes workspace invitations",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const {createHash,randomUUID}=await import("node:crypto");
 const {
  createWorkspaceInvitation,listWorkspaceInvitations,revokeWorkspaceInvitation
 }=await import("../../src/modules/identity/application/workspace-invitations.js");
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const suffix=randomUUID();
 const email=`lifecycle-${suffix}@example.test`;
 let workspaceId,ownerId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Invitation lifecycle',$1) RETURNING id",[`invite-lifecycle-${suffix}`]);
  workspaceId=workspace.rows[0].id;
  const owner=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[`owner-${suffix}`,`owner-${suffix}@example.test`]);
  ownerId=owner.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,ownerId]);
  const first=await createWorkspaceInvitation(pool,{workspaceId,email,role:"analyst",actorRole:"owner",actorUserId:ownerId,actorSubject:`owner-${suffix}`});
  assert.equal(first.email,email);
  assert.equal(typeof first.token,"string");
  const stored=await pool.query("SELECT token_hash FROM workspace_invitations WHERE id=$1",[first.id]);
  assert.equal(stored.rows[0].token_hash,createHash("sha256").update(first.token,"utf8").digest("hex"));
  assert.equal((await listWorkspaceInvitations(pool,workspaceId)).length,1);
  const duplicate=await createWorkspaceInvitation(pool,{workspaceId,email,role:"viewer",actorRole:"owner",actorUserId:ownerId,actorSubject:`owner-${suffix}`});
  assert.equal(duplicate.error,"INVITATION_ALREADY_PENDING");
  const revoked=await revokeWorkspaceInvitation(pool,{workspaceId,invitationId:first.id,actorUserId:ownerId,actorSubject:`owner-${suffix}`});
  assert.deepEqual(revoked,{id:first.id,revoked:true});
  assert.equal((await listWorkspaceInvitations(pool,workspaceId)).length,0);
  const replacement=await createWorkspaceInvitation(pool,{workspaceId,email,role:"viewer",actorRole:"owner",actorUserId:ownerId,actorSubject:`owner-${suffix}`});
  assert.equal(replacement.email,email);
  const events=await pool.query("SELECT event_type,count(*)::int AS count FROM audit_logs WHERE workspace_id=$1 AND event_type IN ('workspace_invitation.created','workspace_invitation.revoked') GROUP BY event_type",[workspaceId]);
  const counts=Object.fromEntries(events.rows.map(row=>[row.event_type,row.count]));
  assert.equal(counts["workspace_invitation.created"],2);
  assert.equal(counts["workspace_invitation.revoked"],1);
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]);
  if(ownerId)await pool.query("DELETE FROM users WHERE id=$1",[ownerId]);
  await pool.end();
 }
});


test("PostgreSQL serializes concurrent member additions and owner role changes",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const {randomUUID}=await import("node:crypto");
 const {addWorkspaceMember,updateWorkspaceMemberRole}=await import("../../src/modules/identity/application/workspace-members.js");
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const suffix=randomUUID();
 const ownerASubject=`owner-a-${suffix}`;
 const ownerBSubject=`owner-b-${suffix}`;
 const emailA=`owner-a-${suffix}@example.test`;
 const emailB=`owner-b-${suffix}@example.test`;
 const memberEmail=`member-${suffix}@example.test`;
 let workspaceId,ownerAId,ownerBId,memberId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Member concurrency',$1) RETURNING id",[`member-concurrency-${suffix}`]);
  workspaceId=workspace.rows[0].id;
  const ownerA=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[ownerASubject,emailA]);
  ownerAId=ownerA.rows[0].id;
  const ownerB=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[ownerBSubject,emailB]);
  ownerBId=ownerB.rows[0].id;
  const member=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[`member-${suffix}`,memberEmail]);
  memberId=member.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'owner')",[workspaceId,ownerAId,ownerBId]);

  const roleChanges=await Promise.all([
   updateWorkspaceMemberRole(pool,{workspaceId,userId:ownerAId,role:"analyst",actorRole:"owner",actorSubject:ownerASubject}),
   updateWorkspaceMemberRole(pool,{workspaceId,userId:ownerBId,role:"analyst",actorRole:"owner",actorSubject:ownerBSubject})
  ]);
  assert.equal(roleChanges.filter(result=>result?.role==="analyst").length,1);
  assert.equal(roleChanges.filter(result=>result?.error==="LAST_OWNER").length,1);
  const remainingOwners=await pool.query("SELECT count(*)::int AS total FROM workspace_members WHERE workspace_id=$1 AND role='owner'",[workspaceId]);
  assert.equal(remainingOwners.rows[0].total,1);

  const remainingOwner=await pool.query("SELECT u.auth_subject FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=$1 AND wm.role='owner'",[workspaceId]);
  const actorSubject=remainingOwner.rows[0].auth_subject;
  const additions=await Promise.all([
   addWorkspaceMember(pool,{workspaceId,email:memberEmail,role:"viewer",actorRole:"owner",actorSubject}),
   addWorkspaceMember(pool,{workspaceId,email:memberEmail,role:"viewer",actorRole:"owner",actorSubject})
  ]);
  assert.equal(additions.filter(result=>result?.user_id===memberId).length,1);
  assert.equal(additions.filter(result=>result?.error==="ALREADY_MEMBER").length,1);
  const membership=await pool.query("SELECT count(*)::int AS total FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",[workspaceId,memberId]);
  assert.equal(membership.rows[0].total,1);
  const audit=await pool.query("SELECT count(*)::int AS total FROM audit_logs WHERE workspace_id=$1 AND event_type IN ('workspace_member.role_changed','workspace_member.added')",[workspaceId]);
  assert.equal(audit.rows[0].total,2);
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]);
  for(const id of [ownerAId,ownerBId,memberId])if(id)await pool.query("DELETE FROM users WHERE id=$1",[id]);
  await pool.end();
 }
});


test("PostgreSQL serializes invitation acceptance against revocation using one lock order",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const {createHash,randomUUID}=await import("node:crypto");
 const {acceptWorkspaceInvitation,revokeWorkspaceInvitation}=await import("../../src/modules/identity/application/workspace-invitations.js");
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:4});
 const suffix=randomUUID();
 const ownerSubject=`race-owner-${suffix}`;
 const invitedSubject=`race-invitee-${suffix}`;
 const invitedEmail=`race-invitee-${suffix}@example.test`;
 const token=`accept-or-revoke-${suffix}-one-time-token`;
 let workspaceId,ownerId,invitationId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Invitation accept revoke race',$1) RETURNING id",[`invite-race-${suffix}`]);
  workspaceId=workspace.rows[0].id;
  const owner=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[ownerSubject,`race-owner-${suffix}@example.test`]);
  ownerId=owner.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,ownerId]);
  const inserted=await pool.query("INSERT INTO workspace_invitations(workspace_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,'analyst',$3,$4,NOW()+INTERVAL '1 day') RETURNING id",[workspaceId,invitedEmail,createHash("sha256").update(token,"utf8").digest("hex"),ownerId]);
  invitationId=inserted.rows[0].id;
  const [accepted,revoked]=await Promise.all([
   acceptWorkspaceInvitation(pool,{token,identity:{subject:invitedSubject,email:invitedEmail}}),
   revokeWorkspaceInvitation(pool,{workspaceId,invitationId,actorSubject:ownerSubject})
  ]);
  const stored=await pool.query("SELECT accepted_at,revoked_at FROM workspace_invitations WHERE id=$1",[invitationId]);
  assert.ok(stored.rows[0]);
  if(accepted.accepted){
   assert.equal(revoked,null);
   assert.ok(stored.rows[0].accepted_at);
   assert.equal(stored.rows[0].revoked_at,null);
  }else{
   assert.equal(accepted.error,"INVITATION_REVOKED");
   assert.deepEqual(revoked,{id:invitationId,revoked:true});
   assert.equal(stored.rows[0].accepted_at,null);
   assert.ok(stored.rows[0].revoked_at);
  }
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]);
  await pool.query("DELETE FROM users WHERE auth_subject=$1",[invitedSubject]).catch(()=>{});
  if(ownerId)await pool.query("DELETE FROM users WHERE id=$1",[ownerId]);
  await pool.end();
 }
});


test("PostgreSQL migration runner grants runtime DML but protects audit and migration history",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 let createdRole=false;
 try{
  const existing=await pool.query("SELECT 1 FROM pg_roles WHERE rolname='radar_runtime'");
  if(existing.rowCount===0){await pool.query("CREATE ROLE radar_runtime NOLOGIN");createdRole=true;}
  await applyMigrations(pool);
  const roleAttributes=await pool.query(`
   SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
    has_database_privilege('radar_runtime',current_database(),'CREATE') AS can_create_database_objects
   FROM pg_roles WHERE rolname='radar_runtime'
  `);
  assert.deepEqual(roleAttributes.rows[0],{
   rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,
   can_create_database_objects:false
  });
  const privileges=await pool.query(`
   SELECT
    has_table_privilege('radar_runtime','workspaces','SELECT') AS can_read_workspaces,
    has_table_privilege('radar_runtime','workspaces','INSERT') AS can_insert_workspaces,
    has_table_privilege('radar_runtime','workspaces','UPDATE') AS can_update_workspaces,
    has_table_privilege('radar_runtime','workspaces','DELETE') AS can_delete_workspaces,
    has_table_privilege('radar_runtime','audit_logs','INSERT') AS can_append_audit,
    has_table_privilege('radar_runtime','audit_logs','SELECT') AS can_read_audit,
    has_table_privilege('radar_runtime','audit_logs','UPDATE') AS can_update_audit,
    has_table_privilege('radar_runtime','audit_logs','DELETE') AS can_delete_audit,
    has_table_privilege('radar_runtime','audit_logs','TRUNCATE') AS can_truncate_audit,
    has_table_privilege('radar_runtime','schema_migrations','SELECT') AS can_read_migrations,
    has_schema_privilege('radar_runtime','public','CREATE') AS can_create_objects
  `);
  assert.deepEqual(privileges.rows[0],{
   can_read_workspaces:true,can_insert_workspaces:true,can_update_workspaces:true,can_delete_workspaces:true,
   can_append_audit:true,can_read_audit:false,can_update_audit:false,can_delete_audit:false,can_truncate_audit:false,
   can_read_migrations:false,can_create_objects:false
  });
 }finally{
  if(createdRole){await pool.query("DROP OWNED BY radar_runtime");await pool.query("DROP ROLE radar_runtime");}
  await pool.end();
 }
});


test("PostgreSQL blocks an audited tenant mutation after workspace membership is revoked",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const {randomUUID}=await import("node:crypto");
 const {executeAuditedMutation}=await import("../../src/modules/market-intelligence/application/audit-transaction.js");
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const suffix=randomUUID();
 const subject="revoked-writer-"+suffix;
 let workspaceId,userId;
 try{
  await applyMigrations(pool);
  const workspace=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Revoked writer',$1) RETURNING id",["revoked-writer-"+suffix]);
  workspaceId=workspace.rows[0].id;
  const user=await pool.query("INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",[subject,"revoked-"+suffix+"@example.test"]);
  userId=user.rows[0].id;
  await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'analyst')",[workspaceId,userId]);
  await pool.query("DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",[workspaceId,userId]);
  let mutationExecuted=false;
  await assert.rejects(
   ()=>executeAuditedMutation(pool,{
    workspaceId,actorUserId:userId,actorSubject:subject,eventType:"tenant.test",resourceType:"test"
   },async client=>{
    mutationExecuted=true;
    return (await client.query("INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Must not exist') RETURNING id",[workspaceId,userId])).rows[0];
   }),
   error=>error.statusCode===403&&error.code==="WORKSPACE_ACCESS_REVOKED"
  );
  assert.equal(mutationExecuted,false);
  const persisted=await pool.query("SELECT count(*)::int AS total FROM competitors WHERE workspace_id=$1 AND name='Must not exist'",[workspaceId]);
  assert.equal(persisted.rows[0].total,0);
  const audit=await pool.query("SELECT count(*)::int AS total FROM audit_logs WHERE workspace_id=$1 AND event_type='tenant.test'",[workspaceId]);
  assert.equal(audit.rows[0].total,0);
 }finally{
  if(workspaceId)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceId]);
  if(userId)await pool.query("DELETE FROM users WHERE id=$1",[userId]);
  await pool.end();
 }
});
