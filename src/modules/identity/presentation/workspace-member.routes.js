import {canAccessWorkspace,findWorkspaceAccess} from "../application/workspace-access.js";
import {addWorkspaceMember,listWorkspaceMembers,removeWorkspaceMember,updateWorkspaceMemberRole} from "../application/workspace-members.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const managers=["owner","admin"];
async function authorize(options,request,reply){
 if(!uuid.test(request.params.workspaceId)){reply.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});return null;}
 const member=await findWorkspaceAccess(options.database,request.identity.subject,request.params.workspaceId);
 if(!canAccessWorkspace(member,managers)){reply.code(403).send({error:"FORBIDDEN",message:"Solo owner o admin pueden gestionar miembros."});return null;}
 return member;
}
function respondError(reply,error){
 const map={INVALID_ROLE:[400,"INVALID_ROLE","El rol solicitado no es válido."],FORBIDDEN_ROLE:[403,"FORBIDDEN_ROLE","No tienes permisos para asignar o modificar ese rol."],USER_NOT_FOUND:[404,"USER_NOT_FOUND","No existe una cuenta activa con ese correo."],ALREADY_MEMBER:[409,"ALREADY_MEMBER","La persona ya pertenece a este espacio."],LAST_OWNER:[409,"LAST_OWNER","El espacio debe conservar al menos un propietario."]};
 const [status,code,message]=map[error]??[400,"MEMBER_OPERATION_FAILED","No se pudo completar la operación."];
 return reply.code(status).send({error:code,message});
}
export async function workspaceMemberRoutes(app,options){
 const auth={preHandler:(r,p)=>options.requireIdentity(r,p)};
 app.get("/api/v1/workspaces/:workspaceId/members",auth,async(r,p)=>{
  if(!await authorize(options,r,p))return;
  return {data:await listWorkspaceMembers(options.database,r.params.workspaceId)};
 });
 app.post("/api/v1/workspaces/:workspaceId/members",auth,async(r,p)=>{
  const actor=await authorize(options,r,p);if(!actor)return;
  const email=typeof r.body?.email==="string"?r.body.email.trim():"";
  if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return p.code(400).send({error:"INVALID_EMAIL",message:"Ingresa un correo válido."});
  const result=await addWorkspaceMember(options.database,{workspaceId:r.params.workspaceId,email,role:r.body?.role,actorRole:actor.role,actorSubject:r.identity.subject});
  if(result?.error)return respondError(p,result.error);
  if(!result)return p.code(404).send({error:"WORKSPACE_NOT_FOUND",message:"No se encontró el espacio activo."});
  return p.code(201).send({data:result});
 });
 app.patch("/api/v1/workspaces/:workspaceId/members/:userId",auth,async(r,p)=>{
  const actor=await authorize(options,r,p);if(!actor)return;
  if(!uuid.test(r.params.userId))return p.code(400).send({error:"INVALID_USER_ID",message:"El identificador de usuario no es válido."});
  const result=await updateWorkspaceMemberRole(options.database,{workspaceId:r.params.workspaceId,userId:r.params.userId,role:r.body?.role,actorRole:actor.role,actorSubject:r.identity.subject});
  if(result?.error)return respondError(p,result.error);
  if(!result)return p.code(404).send({error:"MEMBER_NOT_FOUND",message:"No se encontró el miembro."});
  return {data:result};
 });
 app.delete("/api/v1/workspaces/:workspaceId/members/:userId",auth,async(r,p)=>{
  const actor=await authorize(options,r,p);if(!actor)return;
  if(!uuid.test(r.params.userId))return p.code(400).send({error:"INVALID_USER_ID",message:"El identificador de usuario no es válido."});
  const result=await removeWorkspaceMember(options.database,{workspaceId:r.params.workspaceId,userId:r.params.userId,actorRole:actor.role,actorSubject:r.identity.subject});
  if(result?.error)return respondError(p,result.error);
  if(!result)return p.code(404).send({error:"MEMBER_NOT_FOUND",message:"No se encontró el miembro."});
  return {data:result};
 });
}
