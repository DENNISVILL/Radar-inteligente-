/**
 * Persists a domain mutation and its audit event atomically.
 * The audit row is written only when the mutation returns a resource.
 */
export async function executeAuditedMutation(pool,{workspaceId,actorUserId,eventType,resourceType,metadata={}},mutation){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
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
