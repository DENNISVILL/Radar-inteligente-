/** Persistence operations for research-scoped commercial evidence. */
export async function listMarketObservations(db,workspaceId,researchId,{competitorId,type,limit=50}={}){
 const values=[workspaceId,researchId];let where="workspace_id=$1 AND research_id=$2";
 if(competitorId){values.push(competitorId);where+=` AND competitor_id=$${values.length}`;}
 if(type){values.push(type);where+=` AND observation_type=$${values.length}`;}
 values.push(limit);
 const result=await db.query(`SELECT id,workspace_id,research_id,competitor_id,observation_type,title,content,source_name,source_url,observed_on,confidence,recorded_by,created_at FROM market_observations WHERE ${where} ORDER BY observed_on DESC,created_at DESC LIMIT $${values.length}`,values);
 return result.rows;
}
export async function createMarketObservation(db,workspaceId,userId,researchId,input){
 const result=await db.query("INSERT INTO market_observations(workspace_id,research_id,competitor_id,observation_type,title,content,source_name,source_url,observed_on,confidence,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,workspace_id,research_id,competitor_id,observation_type,title,content,source_name,source_url,observed_on,confidence,recorded_by,created_at",[workspaceId,researchId,input.competitorId??null,input.type,input.title,input.content,input.sourceName??null,input.sourceUrl??null,input.observedOn,input.confidence??"medium",userId]);
 return result.rows[0];
}
