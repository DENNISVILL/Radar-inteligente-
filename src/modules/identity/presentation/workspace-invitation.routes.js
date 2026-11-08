import {ensureIdentityUser} from "../application/identity-user.js";
import {canAccessWorkspace,findWorkspaceAccess} from "../application/workspace-access.js";
import {acceptWorkspaceInvitation,createWorkspaceInvitation,listWorkspaceInvitations,revokeWorkspaceInvitation} from "../application/workspace-invitations.js";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const managers=["owner","admin"];
async function authorize(options,request,reply){
 if(!uuid.test(request.params.workspaceId)){reply.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});return null;}
 const member=await findWorkspaceAccess(options.database,request.identity.subject,request.params.workspaceId);
 if(!canAccessWorkspace(member,managers)){reply.code(403).send({error:"FORBIDDEN",message:"Solo owner o admin pueden gestionar invitaciones."});return null;}
 return member;
}
const messages={
 INVALID_ROLE:[400,"INVALID_ROLE","El rol solicitado no es válido."],
 FORBIDDEN_ROLE:[403,"FORBIDDEN_ROLE","No tienes permisos para asignar ese rol."],
 FORBIDDEN:[403,"FORBIDDEN","Ya no tienes permisos para gestionar las invitaciones de este espacio."],
 INVITATION_ALREADY_PENDING:[409,"INVITATION_ALREADY_PENDING","Ya existe una invitación pendiente para ese correo."],
 INVALID_INVITATION:[400,"INVALID_INVITATION","El token de invitación no es válido."],
 INVITATION_ALREADY_USED:[409,"INVITATION_ALREADY_USED","Esta invitación ya fue utilizada."],
 INVITATION_REVOKED:[410,"INVITATION_REVOKED","Esta invitación fue revocada."],
 INVITATION_EXPIRED:[410,"INVITATION_EXPIRED","Esta invitación ha vencido."],
 INVITATION_EMAIL_MISMATCH:[403,"INVITATION_EMAIL_MISMATCH","La invitación no corresponde al correo de la sesión."],
 WORKSPACE_NOT_FOUND:[404,"WORKSPACE_NOT_FOUND","El espacio ya no está disponible."],
 ALREADY_MEMBER:[409,"ALREADY_MEMBER","Esta cuenta ya pertenece al espacio."],
 ACCOUNT_DISABLED:[403,"ACCOUNT_DISABLED","La cuenta no está habilitada para utilizar Radar Comercial."]
};
function fail(reply,error){
 const [status,code,message]=messages[error]??[400,"INVITATION_FAILED","No se pudo completar la operación."];
 return reply.code(status).send({error:code,message});
}
export async function workspaceInvitationRoutes(app,options){
 const auth={preHandler:(r,p)=>options.requireIdentity(r,p)};
 app.get("/api/v1/workspaces/:workspaceId/invitations",auth,async(r,p)=>{
  if(!await authorize(options,r,p))return;
  return {data:await listWorkspaceInvitations(options.database,r.params.workspaceId)};
 });
 app.post("/api/v1/workspaces/:workspaceId/invitations",auth,async(r,p)=>{
  const actor=await authorize(options,r,p);if(!actor)return;
  const email=typeof r.body?.email==="string"?r.body.email.trim():"";
  if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return p.code(400).send({error:"INVALID_EMAIL",message:"Ingresa un correo válido."});
  const user=await ensureIdentityUser(options.database,r.identity);
  const result=await createWorkspaceInvitation(options.database,{workspaceId:r.params.workspaceId,email,role:r.body?.role,actorRole:actor.role,actorUserId:user.id,actorSubject:r.identity.subject});
  if(result?.error)return fail(p,result.error);
  if(!result)return p.code(404).send({error:"WORKSPACE_NOT_FOUND",message:"No se encontró el espacio activo."});
  return p.code(201).send({data:{id:result.id,email:result.email,role:result.role,expiresAt:result.expires_at,token:result.token}});
 });
 app.delete("/api/v1/workspaces/:workspaceId/invitations/:invitationId",auth,async(r,p)=>{
  if(!uuid.test(r.params.workspaceId)){p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});return;}
  if(!uuid.test(r.params.invitationId))return p.code(400).send({error:"INVALID_INVITATION_ID",message:"El identificador de invitación no es válido."});
  const actor=await authorize(options,r,p);if(!actor)return;
  const user=await ensureIdentityUser(options.database,r.identity);
  const result=await revokeWorkspaceInvitation(options.database,{workspaceId:r.params.workspaceId,invitationId:r.params.invitationId,actorUserId:user.id,actorSubject:r.identity.subject});
  if(result?.error)return fail(p,result.error);
  if(!result)return p.code(404).send({error:"INVITATION_NOT_FOUND",message:"No se encontró una invitación pendiente."});
  return {data:result};
 });
 app.post("/api/v1/invitations/accept",auth,async(r,p)=>{
  if(typeof r.identity.email!=="string"||!r.identity.email.trim())return p.code(403).send({error:"EMAIL_REQUIRED",message:"La sesión debe incluir un correo para aceptar la invitación."});
  const token=typeof r.body?.token==="string"?r.body.token:"";
  const result=await acceptWorkspaceInvitation(options.database,{token,identity:r.identity});
  if(result?.error)return fail(p,result.error);
  return {data:result};
 });
}
