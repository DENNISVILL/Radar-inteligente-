import {canAccessWorkspace,findWorkspaceAccess} from "../../identity/application/workspace-access.js";
import {buildMarketReport} from "../application/market-report.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function marketReportRoutes(app,o){
 app.get("/api/v1/workspaces/:workspaceId/researches/:researchId/report",{preHandler:(r,p)=>o.requireIdentity(r,p)},async(r,p)=>{
  if(!uuid.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  const membership=await findWorkspaceAccess(o.database,r.identity.subject,r.params.workspaceId);
  if(!canAccessWorkspace(membership))return p.code(403).send({error:"FORBIDDEN",message:"No tienes acceso a este espacio de trabajo."});
  const data=await buildMarketReport(o.database,r.params.workspaceId,r.params.researchId);
  if(!data)return p.code(404).send({error:"RESEARCH_NOT_FOUND",message:"No se encontró la investigación activa en este espacio."});
  return {data};
 });
}
