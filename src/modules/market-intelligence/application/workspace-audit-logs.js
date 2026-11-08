const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAuditCursor(value){
 if(value===undefined)return null;
 if(typeof value!=="string"||value.length>512)return undefined;
 try{
  const decoded=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
  if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))return undefined;
  if(typeof decoded.createdAt!=="string"||!Number.isFinite(Date.parse(decoded.createdAt)))return undefined;
  if(typeof decoded.id!=="string"||!uuid.test(decoded.id))return undefined;
  return {createdAt:new Date(decoded.createdAt).toISOString(),id:decoded.id};
 }catch{return undefined;}
}

export function encodeAuditCursor(row){
 return Buffer.from(JSON.stringify({
  createdAt:new Date(row.created_at).toISOString(),
  id:row.id
 })).toString("base64url");
}

export async function listWorkspaceAuditLogs(pool,{workspaceId,authSubject,limit=50,cursor=null}){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const workspace=await client.query(
   "SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",
   [workspaceId]
  );
  if(!workspace.rows[0]){
   await client.query("ROLLBACK");
   return {forbidden:true};
  }
  const membership=await client.query(`SELECT wm.role
   FROM workspace_members wm
   JOIN users u ON u.id=wm.user_id
   WHERE wm.workspace_id=$1 AND u.auth_subject=$2 AND u.status='active'
   FOR UPDATE OF wm`,
   [workspaceId,authSubject]
  );
  if(!membership.rows[0]||!["owner","admin"].includes(membership.rows[0].role)){
   await client.query("ROLLBACK");
   return {forbidden:true};
  }
  const result=await client.query(`SELECT id,event_type,resource_type,resource_id,metadata,created_at
   FROM audit_logs
   WHERE workspace_id=$1
     AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid))
   ORDER BY created_at DESC,id DESC
   LIMIT $4`,
   [workspaceId,cursor?.createdAt??null,cursor?.id??null,limit+1]
  );
  await client.query("COMMIT");
  const hasMore=result.rows.length>limit;
  const data=hasMore?result.rows.slice(0,limit):result.rows;
  return {data,nextCursor:hasMore?encodeAuditCursor(data.at(-1)):null};
 }catch(error){
  try{await client.query("ROLLBACK");}catch(rollbackError){error.rollbackError=rollbackError;}
  throw error;
 }finally{
  client.release();
 }
}


import { createHash } from "node:crypto";

function canonicalize(value) {
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==="object"&&!(value instanceof Date)){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
 }
 if(value instanceof Date)return value.toISOString();
 return value;
}

export function serializeAuditLogNdjson(rows) {
 const body=rows.map(row=>JSON.stringify(canonicalize({
  id:row.id,
  event_type:row.event_type,
  resource_type:row.resource_type,
  resource_id:row.resource_id??null,
  metadata:row.metadata??{},
  created_at:row.created_at instanceof Date?row.created_at.toISOString():new Date(row.created_at).toISOString()
 }))).join("\n")+(rows.length?"\n":"");
 return {
  body,
  count:rows.length,
  sha256:createHash("sha256").update(body,"utf8").digest("hex")
 };
}
