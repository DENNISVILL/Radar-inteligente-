import {ensureIdentityUser} from "../../identity/application/identity-user.js";
import {canAccessWorkspace,findWorkspaceAccess} from "../../identity/application/workspace-access.js";
import {buildMarketReport} from "../application/market-report.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writers=["owner","admin","analyst"];
async function authorize(r,p,o,write=false){
 if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
 if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
 const membership=await findWorkspaceAccess(o.database,r.identity.subject,r.params.workspaceId);
 if(!canAccessWorkspace(membership,write?writers:[]))return p.code(403).send({error:"FORBIDDEN",message:"No tienes permisos para esta operación."});
 return true;
}
export async function marketReportRoutes(app,o){
 const base="/api/v1/workspaces/:workspaceId/researches/:researchId";
 app.get(base+"/report",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(await authorize(r,p,o)!==true)return;
  const data=await buildMarketReport(o.database,r.params.workspaceId,r.params.researchId);
  if(!data)return p.code(404).send({error:"RESEARCH_NOT_FOUND",message:"No se encontró la investigación activa en este espacio."});
  return {data};
 });
 app.post(base+"/reports",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(await authorize(r,p,o,true)!==true)return;
  const report=await buildMarketReport(o.database,r.params.workspaceId,r.params.researchId);
  if(!report)return p.code(404).send({error:"RESEARCH_NOT_FOUND",message:"No se encontró la investigación activa en este espacio."});
  const user=await ensureIdentityUser(o.database,r.identity);
  const client=await o.database.connect();
  let saved;
  try{
   await client.query("BEGIN");
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2,0))",[r.params.workspaceId,r.params.researchId]);
   const versionResult=await client.query(`SELECT COALESCE(MAX(version),0)+1 AS version
    FROM market_reports WHERE workspace_id=$1 AND research_id=$2`,
    [r.params.workspaceId,r.params.researchId]);
   const inserted=await client.query(`INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by)
    VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id,version,generated_at`,
    [r.params.workspaceId,r.params.researchId,versionResult.rows[0].version,JSON.stringify(report),user.id]);
   saved=inserted.rows[0];
   await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
    VALUES($1,$2,'market_report.snapshot_created','market_report',$3,
     jsonb_build_object('research_id',$4::uuid,'version',$5))`,
    [r.params.workspaceId,user.id,saved.id,r.params.researchId,saved.version]);
   await client.query("COMMIT");
  }catch(error){
   await client.query("ROLLBACK");
   throw error;
  }finally{
   client.release();
  }
  return p.code(201).send({data:{...saved,report}});
 });
 app.get("/api/v1/workspaces/:workspaceId/audit-logs",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  const membership=await findWorkspaceAccess(o.database,r.identity.subject,r.params.workspaceId);
  if(!canAccessWorkspace(membership,["owner","admin"]))return p.code(403).send({error:"FORBIDDEN",message:"Solo owner o admin pueden consultar la auditoría."});
  const limit=Math.min(Math.max(Number.parseInt(r.query?.limit??"50",10)||50,1),100);
  const result=await o.database.query(`SELECT id,event_type,resource_type,resource_id,metadata,created_at
   FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
   [r.params.workspaceId,limit]);
  return {data:result.rows};
 });
 app.get(base+"/reports",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(await authorize(r,p,o)!==true)return;
  const limit=Math.min(Math.max(Number.parseInt(r.query?.limit??"20",10)||20,1),50);
  const result=await o.database.query(`SELECT id,version,generated_at,generated_by
   FROM market_reports WHERE workspace_id=$1 AND research_id=$2
   ORDER BY version DESC LIMIT $3`,[r.params.workspaceId,r.params.researchId,limit]);
  return {data:result.rows};
 });
 app.get(base+"/reports/:reportId",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(await authorize(r,p,o)!==true)return;
  if(!uuid.test(r.params.reportId))return p.code(400).send({error:"INVALID_REPORT_ID",message:"El identificador del informe no es válido."});
  const result=await o.database.query(`SELECT id,version,generated_at,generated_by,report_data
   FROM market_reports WHERE workspace_id=$1 AND research_id=$2 AND id=$3`,
   [r.params.workspaceId,r.params.researchId,r.params.reportId]);
  if(!result.rows[0])return p.code(404).send({error:"REPORT_NOT_FOUND",message:"No se encontró esa versión del informe."});
  return {data:result.rows[0]};
 });
}
