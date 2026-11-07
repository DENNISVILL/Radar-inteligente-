import {ensureIdentityUser} from "../../identity/application/identity-user.js";
import {canAccessWorkspace,findWorkspaceAccess} from "../../identity/application/workspace-access.js";
import {executeAuditedMutation} from "../application/audit-transaction.js";
import {archiveCompetitor,archiveMarketProduct,createCompetitor,createMarketProduct,createPriceObservation,getCompetitor,getMarketProduct,listCompetitors,listMarketProducts,listPriceObservations,listMarketObservations,createMarketObservation,validateMarketObservation, getMarketAnalysis,updateCompetitor,updateMarketProduct,validateCompetitor,validateCompetitorUpdate,validateMarketProduct,validateMarketProductUpdate,validatePriceObservation} from "../application/market-intelligence.js";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writers=["owner","admin","analyst"];

async function access(o,r,p,write=false){
 const m=await findWorkspaceAccess(o.database,r.identity.subject,r.params.workspaceId);
 if(!canAccessWorkspace(m,write?writers:[])){
  p.code(403).send({error:"FORBIDDEN",message:"No tienes permisos para esta operación."});
  return false;
 }
 return true;
}
function workspace(r,p){
 if(!uuid.test(r.params.workspaceId)){
  p.code(400).send({error:"INVALID_WORKSPACE_ID",message:"El identificador del espacio no es válido."});
  return false;
 }
 return true;
}
function limit(q,p){
 const n=q?.limit===undefined?50:Number(q.limit);
 if(!Number.isInteger(n)||n<1||n>100){
  p.code(400).send({error:"INVALID_LIMIT",message:"El límite debe estar entre 1 y 100."});
  return null;
 }
 return n;
}
async function audited(o,r,user,eventType,resourceType,metadata,mutation){
 return executeAuditedMutation(o.database,{
  workspaceId:r.params.workspaceId,actorUserId:user.id,eventType,resourceType,metadata
 },mutation);
}

export async function marketIntelligenceRoutes(app,o){
 const auth={preHandler:(r,p)=>o.requireIdentity(r,p)};
 app.get("/api/v1/workspaces/:workspaceId/competitors",auth,async(r,p)=>{
  if(!workspace(r,p)||!await access(o,r,p))return;
  const n=limit(r.query,p);if(!n)return;
  return {data:await listCompetitors(o.database,r.params.workspaceId,{limit:n})};
 });
 app.post("/api/v1/workspaces/:workspaceId/competitors",auth,async(r,p)=>{
  if(!workspace(r,p)||!await access(o,r,p,true))return;
  const e=validateCompetitor(r.body);if(e)return p.code(400).send({error:"INVALID_COMPETITOR",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_competitor.created","competitor",{name:r.body.name},db=>createCompetitor(db,r.params.workspaceId,u.id,r.body));
  return p.code(201).send({data});
 });
 app.get("/api/v1/workspaces/:workspaceId/products",auth,async(r,p)=>{
  if(!workspace(r,p)||!await access(o,r,p))return;
  const n=limit(r.query,p);if(!n)return;
  for(const k of ["competitorId","researchId"])if(r.query?.[k]&&!uuid.test(r.query[k]))return p.code(400).send({error:"INVALID_FILTER",message:`El filtro ${k} no es válido.`});
  return {data:await listMarketProducts(o.database,r.params.workspaceId,{competitorId:r.query?.competitorId,researchId:r.query?.researchId,limit:n})};
 });
 app.post("/api/v1/workspaces/:workspaceId/products",auth,async(r,p)=>{
  if(!workspace(r,p)||!await access(o,r,p,true))return;
  const e=validateMarketProduct(r.body);if(e)return p.code(400).send({error:"INVALID_PRODUCT",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_product.created","market_product",{name:r.body.name},db=>createMarketProduct(db,r.params.workspaceId,u.id,r.body));
  return p.code(201).send({data});
 });
 app.get("/api/v1/workspaces/:workspaceId/products/:productId/prices",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.productId))return p.code(400).send({error:"INVALID_PRODUCT_ID",message:"El identificador del producto no es válido."});
  if(!await access(o,r,p))return;
  const n=limit(r.query,p);if(!n)return;
  return {data:await listPriceObservations(o.database,r.params.workspaceId,r.params.productId,{limit:n})};
 });
 app.post("/api/v1/workspaces/:workspaceId/products/:productId/prices",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.productId))return p.code(400).send({error:"INVALID_PRODUCT_ID",message:"El identificador del producto no es válido."});
  if(!await access(o,r,p,true))return;
  const e=validatePriceObservation(r.body);if(e)return p.code(400).send({error:"INVALID_PRICE_OBSERVATION",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_price_observation.created","price_observation",{productId:r.params.productId,currency:r.body.currency},db=>createPriceObservation(db,r.params.workspaceId,u.id,r.params.productId,r.body));
  return p.code(201).send({data});
 });
 app.patch("/api/v1/workspaces/:workspaceId/competitors/:competitorId",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.competitorId))return p.code(400).send({error:"INVALID_COMPETITOR_ID",message:"El identificador del competidor no es válido."});
  if(!await access(o,r,p,true))return;
  const e=validateCompetitorUpdate(r.body);if(e)return p.code(400).send({error:"INVALID_COMPETITOR",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_competitor.updated","competitor",{changedFields:Object.keys(r.body)},db=>updateCompetitor(db,r.params.workspaceId,r.params.competitorId,r.body));
  if(!data)return p.code(404).send({error:"NOT_FOUND",message:"No se encontró el competidor activo en este espacio."});
  return {data};
 });
 app.delete("/api/v1/workspaces/:workspaceId/competitors/:competitorId",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.competitorId))return p.code(400).send({error:"INVALID_COMPETITOR_ID",message:"El identificador del competidor no es válido."});
  if(!await access(o,r,p,true))return;
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_competitor.archived","competitor",{},db=>archiveCompetitor(db,r.params.workspaceId,r.params.competitorId));
  if(!data)return p.code(404).send({error:"NOT_FOUND",message:"No se encontró un competidor activo en este espacio."});
  return {data};
 });
 app.patch("/api/v1/workspaces/:workspaceId/products/:productId",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.productId))return p.code(400).send({error:"INVALID_PRODUCT_ID",message:"El identificador del producto no es válido."});
  if(!await access(o,r,p,true))return;
  const e=validateMarketProductUpdate(r.body);if(e)return p.code(400).send({error:"INVALID_PRODUCT",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_product.updated","market_product",{changedFields:Object.keys(r.body)},db=>updateMarketProduct(db,r.params.workspaceId,r.params.productId,r.body));
  if(!data)return p.code(404).send({error:"NOT_FOUND",message:"No se encontró el producto activo en este espacio."});
  return {data};
 });
 app.delete("/api/v1/workspaces/:workspaceId/products/:productId",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.productId))return p.code(400).send({error:"INVALID_PRODUCT_ID",message:"El identificador del producto no es válido."});
  if(!await access(o,r,p,true))return;
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_product.archived","market_product",{},db=>archiveMarketProduct(db,r.params.workspaceId,r.params.productId));
  if(!data)return p.code(404).send({error:"NOT_FOUND",message:"No se encontró un producto activo en este espacio."});
  return {data};
 });
 app.get("/api/v1/workspaces/:workspaceId/researches/:researchId/observations",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  if(!await access(o,r,p))return;
  const n=limit(r.query,p);if(!n)return;
  if(r.query?.competitorId&&!uuid.test(r.query.competitorId))return p.code(400).send({error:"INVALID_FILTER",message:"El filtro de competidor no es válido."});
  const allowed=["strength","weakness","promotion","customer_experience","strategy","opportunity","risk","other"];
  if(r.query?.type&&!allowed.includes(r.query.type))return p.code(400).send({error:"INVALID_FILTER",message:"El tipo de observación no es válido."});
  return {data:await listMarketObservations(o.database,r.params.workspaceId,r.params.researchId,{competitorId:r.query?.competitorId,type:r.query?.type,limit:n})};
 });
 app.post("/api/v1/workspaces/:workspaceId/researches/:researchId/observations",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  if(!await access(o,r,p,true))return;
  if(r.body?.competitorId&&!uuid.test(r.body.competitorId))return p.code(400).send({error:"INVALID_COMPETITOR_ID",message:"El identificador de competidor no es válido."});
  const e=validateMarketObservation(r.body);if(e)return p.code(400).send({error:"INVALID_OBSERVATION",message:e});
  const u=await ensureIdentityUser(o.database,r.identity);
  const data=await audited(o,r,u,"market_observation.created","market_observation",{researchId:r.params.researchId,type:r.body.type},db=>createMarketObservation(db,r.params.workspaceId,u.id,r.params.researchId,r.body));
  return p.code(201).send({data});
 });
 app.get("/api/v1/workspaces/:workspaceId/researches/:researchId/analysis",auth,async(r,p)=>{
  if(!workspace(r,p))return;
  if(!uuid.test(r.params.researchId))return p.code(400).send({error:"INVALID_RESEARCH_ID",message:"El identificador de investigación no es válido."});
  if(!await access(o,r,p))return;
  return {data:await getMarketAnalysis(o.database,r.params.workspaceId,r.params.researchId)};
 });
}
