const manageable=["admin","analyst","viewer"];
export async function listWorkspaceMembers(database,workspaceId){
 const result=await database.query(`SELECT u.id AS user_id,u.email,u.display_name,wm.role,wm.created_at AS joined_at
 FROM workspace_members wm JOIN users u ON u.id=wm.user_id
 WHERE wm.workspace_id=$1 AND u.status='active'
 ORDER BY CASE wm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'analyst' THEN 3 ELSE 4 END,u.email`,[workspaceId]);
 return result.rows;
}
async function lockWorkspace(database,workspaceId,actorSubject){
 const client=await database.connect();
 try{
  await client.query("BEGIN");
  const workspace=await client.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",[workspaceId]);
  if(!workspace.rows[0]){await client.query("ROLLBACK");client.release();return null;}
  const actor=await client.query(`SELECT wm.role
   FROM workspace_members wm JOIN users u ON u.id=wm.user_id
   WHERE wm.workspace_id=$1 AND u.auth_subject=$2 AND u.status='active'
   FOR UPDATE OF wm`,[workspaceId,actorSubject]);
  const actorRole=actor.rows[0]?.role;
  if(!["owner","admin"].includes(actorRole)){
   await client.query("ROLLBACK");client.release();return {error:"FORBIDDEN"};
  }
  return {client,actorRole};
 }catch(error){try{await client.query("ROLLBACK");}finally{client.release();}throw error;}
}
async function writeAudit(client,workspaceId,actorSubject,eventType,userId,metadata){
 await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
 VALUES($1,(SELECT id FROM users WHERE auth_subject=$2),$3,'workspace_member',$4,$5::jsonb)`,
 [workspaceId,actorSubject,eventType,userId,JSON.stringify(metadata)]);
}
export async function addWorkspaceMember(database,{workspaceId,email,role,actorRole,actorSubject}){
 if(!manageable.includes(role))return {error:"INVALID_ROLE"};
 if(actorRole==="admin"&&role!=="analyst"&&role!=="viewer")return {error:"FORBIDDEN_ROLE"};
 const locked=await lockWorkspace(database,workspaceId,actorSubject);if(!locked||locked.error)return locked;const {client,actorRole:currentActorRole}=locked;
 try{
  const target=await client.query("SELECT id,email,display_name,status FROM users WHERE lower(email)=lower($1) LIMIT 1",[email]);
  if(!target.rows[0]||target.rows[0].status!=="active"){await client.query("ROLLBACK");return {error:"USER_NOT_FOUND"};}
  const result=await client.query(`INSERT INTO workspace_members(workspace_id,user_id,role)
  VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO NOTHING RETURNING workspace_id,user_id,role,created_at`,[workspaceId,target.rows[0].id,role]);
  if(!result.rows[0]){await client.query("ROLLBACK");return {error:"ALREADY_MEMBER"};}
  await writeAudit(client,workspaceId,actorSubject,"workspace_member.added",target.rows[0].id,{role});
  await client.query("COMMIT");
  return {...result.rows[0],email:target.rows[0].email,display_name:target.rows[0].display_name};
 }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
}
export async function updateWorkspaceMemberRole(database,{workspaceId,userId,role,actorRole,actorSubject}){
 if(!["owner","admin","analyst","viewer"].includes(role))return {error:"INVALID_ROLE"};
 if(actorRole==="admin"&&!["analyst","viewer"].includes(role))return {error:"FORBIDDEN_ROLE"};
 if(actorRole!=="owner"&&role==="owner")return {error:"FORBIDDEN_ROLE"};
 const client=await lockWorkspace(database,workspaceId);if(!client)return null;
 try{
  const target=await client.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",[workspaceId,userId]);
  if(!target.rows[0]){await client.query("ROLLBACK");return null;}
  if(target.rows[0].role==="owner"&&currentActorRole!=="owner"){await client.query("ROLLBACK");return {error:"FORBIDDEN_ROLE"};}
  if(target.rows[0].role==="owner"&&role!=="owner"){
   const count=await client.query("SELECT COUNT(*)::int AS total FROM workspace_members WHERE workspace_id=$1 AND role='owner'",[workspaceId]);
   if(count.rows[0].total<=1){await client.query("ROLLBACK");return {error:"LAST_OWNER"};}
  }
  const updated=await client.query("UPDATE workspace_members SET role=$3 WHERE workspace_id=$1 AND user_id=$2 RETURNING workspace_id,user_id,role,created_at",[workspaceId,userId,role]);
  await writeAudit(client,workspaceId,actorSubject,"workspace_member.role_changed",userId,{previousRole:target.rows[0].role,newRole:role});
  await client.query("COMMIT");return updated.rows[0];
 }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
}
export async function removeWorkspaceMember(database,{workspaceId,userId,actorRole,actorSubject}){
 const client=await lockWorkspace(database,workspaceId);if(!client)return null;
 try{
  const target=await client.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",[workspaceId,userId]);
  if(!target.rows[0]){await client.query("ROLLBACK");return null;}
  if(target.rows[0].role==="owner"){
   if(currentActorRole!=="owner"){await client.query("ROLLBACK");return {error:"FORBIDDEN_ROLE"};}
   const count=await client.query("SELECT COUNT(*)::int AS total FROM workspace_members WHERE workspace_id=$1 AND role='owner'",[workspaceId]);
   if(count.rows[0].total<=1){await client.query("ROLLBACK");return {error:"LAST_OWNER"};}
  }
  await client.query("DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",[workspaceId,userId]);
  await writeAudit(client,workspaceId,actorSubject,"workspace_member.removed",userId,{previousRole:target.rows[0].role});
  await client.query("COMMIT");return {workspaceId,userId,removed:true};
 }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
}
