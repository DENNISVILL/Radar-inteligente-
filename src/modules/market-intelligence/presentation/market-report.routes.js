import {ensureIdentityUser} from "../../identity/application/identity-user.js";
import {canAccessWorkspace,findWorkspaceAccess} from "../../identity/application/workspace-access.js";
import {buildMarketReport} from "../application/market-report.js";
import {generateMarketReportPdf} from "../application/market-report-pdf.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writers=["owner","admin","analyst"];
function queryLimit(value,fallback,maximum){
 const limit=value===undefined?fallback:Number(value);
 return Number.isInteger(limit)&&limit>=1&&limit<=maximum?limit:null;
}
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
  const user=await ensureIdentityUser(o.database,r.identity);
  const client=await o.database.connect();
  const lockKey=`${r.params.workspaceId}:${r.params.researchId}`;
  let lockAcquired=false,transactionStarted=false,report,saved,researchNotFound=false;
  try{
   await client.query("SELECT pg_advisory_lock(hashtextextended($1,0))",[lockKey]);lockAcquired=true;
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");transactionStarted=true;
   report=await buildMarketReport(client,r.params.workspaceId,r.params.researchId);
   if(!report){await client.query("ROLLBACK");transactionStarted=false;researchNotFound=true;}
   else{
    const versionResult=await client.query("SELECT COALESCE(MAX(version),0)+1 AS version FROM market_reports WHERE workspace_id=$1 AND research_id=$2",[r.params.workspaceId,r.params.researchId]);
    const inserted=await client.query(`INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by)
     VALUES($1,$2,$3,$4::jsonb,$5)
     RETURNING id,version,generated_at,report_hash,encode(digest(report_data::text,'sha256'),'hex')=report_hash AS integrity_verified`,
     [r.params.workspaceId,r.params.researchId,versionResult.rows[0].version,JSON.stringify(report),user.id]);
    saved=inserted.rows[0];
    await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
     VALUES($1,$2,'market_report.snapshot_created','market_report',$3,jsonb_build_object('research_id',$4::uuid,'version',$5,'report_hash',$6))`,
     [r.params.workspaceId,user.id,saved.id,r.params.researchId,saved.version,saved.report_hash]);
    await client.query("COMMIT");transactionStarted=false;
   }
  }catch(error){if(transactionStarted){try{await client.query("ROLLBACK");}catch{}transactionStarted=false;}throw error;}
  finally{
   let releaseError;
   if(lockAcquired){try{await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))",[lockKey]);}catch(error){releaseError=error;}}
   client.release(releaseError);if(releaseError)throw releaseError;
  }
  if(researchNotFound)return p.code(404).send({error:"RESEARCH_NOT_FOUND",message:"No se encontró la investigación activa en este espacio."});
  return p.code(201).send({data:{...saved,report}});
 });
 app.get("/api/v1/workspaces/:workspaceId/audit-logs",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  const membership=await findWorkspaceAccess(o.database,r.identity.subject,r.params.workspaceId);
  if(!canAccessWorkspace(membership,["owner","admin"]))return p.code(403).send({error:"FORBIDDEN",message:"Solo owner o admin pueden consultar la auditoría."});
  const limit=queryLimit(r.query?.limit,50,100);
  if(limit===null)return p.code(400).send({error:"INVALID_LIMIT",message:"El límite debe ser un número entero entre 1 y 100."});
  const result=await o.database.query("SELECT id,event_type,resource_type,resource_id,metadata,created_at FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2",[r.params.workspaceId,limit]);
  return {data:result.rows};
 });
 app.get(base+"/reports",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(await authorize(r,p,o)!==true)return;
  const limit=queryLimit(r.query?.limit,20,50);
  if(limit===null)return p.code(400).send({error:"INVALID_LIMIT",message:"El límite debe ser un número entero entre 1 y 50."});
  const result=await o.database.query("SELECT id,version,generated_at,generated_by,report_hash,encode(digest(report_data::text,'sha256'),'hex')=report_hash AS integrity_verified FROM market_reports WHERE workspace_id=$1 AND research_id=$2 ORDER BY version DESC LIMIT $3",[r.params.workspaceId,r.params.researchId,limit]);
  return {data:result.rows};
 });
 app.get(base+"/reports/:reportId/pdf",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  if(!uuid.test(r.params.reportId))return p.code(400).send({error:"INVALID_REPORT_ID",message:"El identificador del informe no es válido."});
  if(await authorize(r,p,o)!==true)return;
  const result=await o.database.query(`SELECT id,version,generated_at,report_data,report_hash,
   encode(digest(report_data::text,'sha256'),'hex')=report_hash AS integrity_verified
   FROM market_reports WHERE workspace_id=$1 AND research_id=$2 AND id=$3`,
   [r.params.workspaceId,r.params.researchId,r.params.reportId]);
  const snapshot=result.rows[0];
  if(!snapshot)return p.code(404).send({error:"REPORT_NOT_FOUND",message:"No se encontró esa versión del informe."});
  if(!snapshot.integrity_verified)return p.code(409).send({error:"REPORT_INTEGRITY_FAILED",message:"No se puede exportar un snapshot cuya integridad no pudo verificarse."});
  const pdf=await generateMarketReportPdf(snapshot.report_data,{id:snapshot.id,version:snapshot.version,generated_at:snapshot.generated_at,report_hash:snapshot.report_hash});
  return p.type("application/pdf").header("Content-Disposition",`attachment; filename="radar-${snapshot.id}-v${snapshot.version}.pdf"`).send(pdf);
 });
 app.get(base+"/reports/:reportId",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  if(!uuid.test(r.params.reportId))return p.code(400).send({error:"INVALID_REPORT_ID",message:"El identificador del informe no es válido."});
  if(await authorize(r,p,o)!==true)return;
  const result=await o.database.query("SELECT id,version,generated_at,generated_by,report_data,report_hash,encode(digest(report_data::text,'sha256'),'hex')=report_hash AS integrity_verified FROM market_reports WHERE workspace_id=$1 AND research_id=$2 AND id=$3",[r.params.workspaceId,r.params.researchId,r.params.reportId]);
  if(!result.rows[0])return p.code(404).send({error:"REPORT_NOT_FOUND",message:"No se encontró esa versión del informe."});
  return {data:result.rows[0]};
 });
}
