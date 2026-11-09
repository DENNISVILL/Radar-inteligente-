const fields = new Map([["title",{column:"title",max:120}],["country",{column:"country",max:80}],["city",{column:"city",max:100,nullable:true}],["sector",{column:"sector",max:100}],["objective",{column:"objective",max:1000}],["status",{column:"status",values:["draft","in_progress","completed"]}]]);
export async function listResearches(db,workspaceId,{status,limit=50}={}) {
 const values=[workspaceId]; let where="workspace_id = $1 AND status <> 'archived'";
 if(status){values.push(status);where+=` AND status = $${values.length}`;}
 values.push(limit);
 const r=await db.query(`SELECT id,workspace_id,created_by,title,country,city,sector,objective,status,created_at,updated_at FROM researches WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT $${values.length}`,values);
 return r.rows;
}
export async function getResearch(db,workspaceId,researchId) {
 const r=await db.query("SELECT id,workspace_id,created_by,title,country,city,sector,objective,status,created_at,updated_at FROM researches WHERE workspace_id=$1 AND id=$2 AND status<>'archived' LIMIT 1",[workspaceId,researchId]); return r.rows[0]??null;
}
export async function createResearch(db,workspaceId,userId,input) {
 const r=await db.query("INSERT INTO researches (workspace_id,created_by,title,country,city,sector,objective,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,workspace_id,created_by,title,country,city,sector,objective,status,created_at,updated_at",[workspaceId,userId,input.title,input.country,input.city??null,input.sector,input.objective,input.status??"draft"]); return r.rows[0];
}
export async function updateResearch(db,workspaceId,researchId,input) {
 const values=[workspaceId,researchId],sets=[];
 for(const [key,value] of Object.entries(input)){const field=fields.get(key);if(!field)continue;values.push(value);sets.push(`${field.column}=$${values.length}`);}
 if(!sets.length)return null;
 const r=await db.query(`UPDATE researches SET ${sets.join(",")} WHERE workspace_id=$1 AND id=$2 AND status<>'archived' RETURNING id,workspace_id,created_by,title,country,city,sector,objective,status,created_at,updated_at`,values);return r.rows[0]??null;
}
export async function archiveResearch(db,workspaceId,researchId) {
 const r=await db.query("UPDATE researches SET status='archived' WHERE workspace_id=$1 AND id=$2 AND status<>'archived' RETURNING id",[workspaceId,researchId]);return r.rowCount>0;
}
export function validateResearchInput(input,{partial=false}={}) {
 if(!input||typeof input!=="object"||Array.isArray(input))return "El cuerpo debe ser un objeto.";
 const keys=Object.keys(input);if(keys.some(k=>!fields.has(k)))return "Hay campos no permitidos.";
 if(partial&&!keys.length)return "Debes indicar al menos un campo para actualizar.";
 for(const k of ["title","country","sector","objective"])if(!partial&&!keys.includes(k))return `El campo ${k} es obligatorio.`;
 for(const [key,value] of Object.entries(input)){const f=fields.get(key);if(value===null&&f.nullable)continue;if(typeof value!=="string")return `El campo ${key} debe ser texto.`;const v=value.trim();if(!v)return `El campo ${key} no puede estar vacío.`;if(f.max&&v.length>f.max)return `El campo ${key} supera el máximo de ${f.max} caracteres.`;if(f.values&&!f.values.includes(v))return `El valor de ${key} no es válido.`;input[key]=v;}
 return null;
}