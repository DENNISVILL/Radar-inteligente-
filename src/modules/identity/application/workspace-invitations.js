import {createHash,randomBytes} from "node:crypto";

const manageableRoles=["admin","analyst","viewer"];
const hashToken=token=>createHash("sha256").update(token,"utf8").digest("hex");
const normalizeEmail=email=>String(email??"").trim().toLowerCase();

export async function listWorkspaceInvitations(database,workspaceId){
 const result=await database.query(`SELECT id,email,role,expires_at,created_at,invited_by
 FROM workspace_invitations
 WHERE workspace_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW()
 ORDER BY created_at DESC`,[workspaceId]);
 return result.rows;
}

export async function createWorkspaceInvitation(database,{workspaceId,email,role,actorRole,actorUserId}){
 if(!manageableRoles.includes(role))return {error:"INVALID_ROLE"};
 if(actorRole==="admin"&&role!=="analyst"&&role!=="viewer")return {error:"FORBIDDEN_ROLE"};
 const normalizedEmail=normalizeEmail(email);
 const token=randomBytes(32).toString("base64url");
 const tokenHash=hashToken(token);
 const client=await database.connect();
 try{
  await client.query("BEGIN");
  const workspace=await client.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",[workspaceId]);
  if(!workspace.rows[0]){await client.query("ROLLBACK");return null;}
  await client.query("UPDATE workspace_invitations SET revoked_at=NOW() WHERE workspace_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=NOW()",[workspaceId]);
  const result=await client.query(`INSERT INTO workspace_invitations(workspace_id,email,role,token_hash,invited_by,expires_at)
   VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days')
   RETURNING id,email,role,expires_at,created_at`,
   [workspaceId,normalizedEmail,role,tokenHash,actorUserId]);
  const invitation=result.rows[0];
  await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
   VALUES($1,$2,'workspace_invitation.created','workspace_invitation',$3,jsonb_build_object('email',$4,'role',$5,'expires_at',$6))`,
   [workspaceId,actorUserId,invitation.id,invitation.email,invitation.role,invitation.expires_at]);
  await client.query("COMMIT");
  return {...invitation,token};
 }catch(error){
  try{await client.query("ROLLBACK");}catch{}
  if(error.code==="23505")return {error:"INVITATION_ALREADY_PENDING"};
  throw error;
 }finally{client.release();}
}

export async function acceptWorkspaceInvitation(database,{token,userId,email}){
 if(typeof token!=="string"||token.length<32||token.length>128)return {error:"INVALID_INVITATION"};
 const client=await database.connect();
 try{
  await client.query("BEGIN");
  const found=await client.query(`SELECT id,workspace_id,email,role,expires_at,accepted_at,revoked_at
   FROM workspace_invitations WHERE token_hash=$1 FOR UPDATE`,[hashToken(token)]);
  const invitation=found.rows[0];
  if(!invitation){await client.query("ROLLBACK");return {error:"INVALID_INVITATION"};}
  if(invitation.accepted_at){await client.query("ROLLBACK");return {error:"INVITATION_ALREADY_USED"};}
  if(invitation.revoked_at){await client.query("ROLLBACK");return {error:"INVITATION_REVOKED"};}
  if(new Date(invitation.expires_at).getTime()<=Date.now()){await client.query("ROLLBACK");return {error:"INVITATION_EXPIRED"};}
  if(normalizeEmail(email)!==normalizeEmail(invitation.email)){await client.query("ROLLBACK");return {error:"INVITATION_EMAIL_MISMATCH"};}
  const workspace=await client.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",[invitation.workspace_id]);
  if(!workspace.rows[0]){await client.query("ROLLBACK");return {error:"WORKSPACE_NOT_FOUND"};}
  const member=await client.query(`INSERT INTO workspace_members(workspace_id,user_id,role)
   VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO NOTHING RETURNING workspace_id,user_id,role,created_at`,
   [invitation.workspace_id,userId,invitation.role]);
  if(!member.rows[0]){await client.query("ROLLBACK");return {error:"ALREADY_MEMBER"};}
  await client.query("UPDATE workspace_invitations SET accepted_at=NOW() WHERE id=$1",[invitation.id]);
  await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
   VALUES($1,$2,'workspace_invitation.accepted','workspace_invitation',$3,jsonb_build_object('role',$4))`,
   [invitation.workspace_id,userId,invitation.id,invitation.role]);
  await client.query("COMMIT");
  return {workspaceId:invitation.workspace_id,userId,role:invitation.role,accepted:true};
 }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}
 finally{client.release();}
}

export async function revokeWorkspaceInvitation(database,{workspaceId,invitationId,actorUserId}){
 const client=await database.connect();
 try{
  await client.query("BEGIN");
  const result=await client.query(`UPDATE workspace_invitations SET revoked_at=NOW()
   WHERE workspace_id=$1 AND id=$2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW()
   RETURNING id,email,role`,[workspaceId,invitationId]);
  if(!result.rows[0]){await client.query("ROLLBACK");return null;}
  await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
   VALUES($1,$2,'workspace_invitation.revoked','workspace_invitation',$3,jsonb_build_object('email',$4,'role',$5))`,
   [workspaceId,actorUserId,result.rows[0].id,result.rows[0].email,result.rows[0].role]);
  await client.query("COMMIT");
  return {id:result.rows[0].id,revoked:true};
 }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}
 finally{client.release();}
}
