/**
 * Persists a domain mutation and its audit event atomically.
 * Workspace authorization is rechecked under the same lock order used by
 * membership changes, preventing a revoked member from winning a TOCTOU race.
 */
export async function executeAuditedMutation(pool,{
 workspaceId,actorUserId,actorSubject,eventType,resourceType,metadata={},
 allowedRoles=["owner","admin","analyst"]
},mutation){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const workspace=await client.query(
   "SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",
   [workspaceId]
  );
  if(!workspace.rows[0]){
   const error=new Error("El espacio ya no está disponible.");
   error.statusCode=403;
   error.code="WORKSPACE_ACCESS_REVOKED";
   throw error;
  }
  const membership=await client.query(`SELECT wm.role
   FROM workspace_members wm
   JOIN users u ON u.id=wm.user_id
   WHERE wm.workspace_id=$1 AND u.auth_subject=$2 AND u.id=$3 AND u.status='active'
   FOR UPDATE OF wm`,
   [workspaceId,actorSubject,actorUserId]
  );
  if(!membership.rows[0]||!allowedRoles.includes(membership.rows[0].role)){
   const error=new Error("Ya no tienes permisos para modificar este espacio.");
   error.statusCode=403;
   error.code="WORKSPACE_ACCESS_REVOKED";
   throw error;
  }
  const resource=await mutation(client);
  if(!resource){
   await client.query("COMMIT");
   return null;
  }
  await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
   VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
   [workspaceId,actorUserId,eventType,resourceType,resource.id,JSON.stringify(metadata)]);
  await client.query("COMMIT");
  return resource;
 }catch(error){
  try{await client.query("ROLLBACK");}catch(rollbackError){error.rollbackError=rollbackError;}
  throw error;
 }finally{
  client.release();
 }
}
