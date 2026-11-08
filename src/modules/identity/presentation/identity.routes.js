import { readBearerToken, verifySupabaseAccessToken } from "../infrastructure/supabase-jwt.js";
import { canAccessWorkspace, findWorkspaceAccess } from "../application/workspace-access.js";
import { workspaceRoutes } from "./workspace.routes.js";
import { workspaceMemberRoutes } from "./workspace-member.routes.js";
import { workspaceInvitationRoutes } from "./workspace-invitation.routes.js";
import { researchRoutes } from "../../research/presentation/research.routes.js";
import { marketIntelligenceRoutes } from "../../market-intelligence/presentation/market-intelligence.routes.js";
import { marketReportRoutes } from "../../market-intelligence/presentation/market-report.routes.js";
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function requireIdentity(request,reply,options){
 const token=readBearerToken(request.headers.authorization);
 if(!token)return reply.code(401).send({error:"UNAUTHORIZED",message:"Se requiere un token Bearer válido."});
 try{request.identity=await verifySupabaseAccessToken(token,options.config.supabaseUrl);}
 catch(error){
  const invalidTokenCodes=new Set([
   "ERR_JWT_EXPIRED",
   "ERR_JWT_INVALID",
   "ERR_JWT_CLAIM_VALIDATION_FAILED",
   "ERR_JWS_INVALID",
   "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
   "ERR_JOSE_ALG_NOT_ALLOWED",
   "ERR_JWKS_NO_MATCHING_KEY"
  ]);
  if(error.statusCode===503)return reply.code(503).send({error:"AUTH_NOT_CONFIGURED",message:"La autenticación todavía no está configurada."});
  if(error.statusCode===401||invalidTokenCodes.has(error.code))return reply.code(401).send({error:"INVALID_TOKEN",message:"El token no es válido o ha expirado."});
  request.log?.error?.({err:error},"No se pudo verificar el token con el proveedor de identidad");
  return reply.code(503).send({error:"AUTH_PROVIDER_UNAVAILABLE",message:"El servicio de autenticación no está disponible temporalmente."});
 }
}
export async function identityRoutes(app,options){
 const routeOptions={database:options.database,requireIdentity:(request,reply)=>requireIdentity(request,reply,options)};
 app.register(workspaceRoutes,routeOptions);
 app.register(workspaceMemberRoutes,routeOptions);
 app.register(workspaceInvitationRoutes,routeOptions);
 app.register(researchRoutes,routeOptions);
 app.register(marketIntelligenceRoutes,routeOptions);
 app.register(marketReportRoutes,routeOptions);
 app.get("/api/v1/me",{preHandler:(r,p)=>requireIdentity(r,p,options)},async r=>({subject:r.identity.subject,email:r.identity.email}));
 app.get("/api/v1/workspaces/:workspaceId/access",{preHandler:(r,p)=>requireIdentity(r,p,options)},async(r,p)=>{
  if(!uuidPattern.test(r.params.workspaceId))return p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio de trabajo no es válido."});
  const membership=await findWorkspaceAccess(options.database,r.identity.subject,r.params.workspaceId);
  if(!canAccessWorkspace(membership))return p.code(403).send({error:"FORBIDDEN",message:"No tienes acceso a este espacio de trabajo."});
  return {workspaceId:membership.workspace_id,workspaceName:membership.workspace_name,role:membership.role};
 });
}
