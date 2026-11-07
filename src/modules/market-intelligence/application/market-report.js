const money=value=>value===null||value===undefined?null:Number(value);
const EVIDENCE_LIMIT=200;
const PRICE_EVIDENCE_LIMIT=25;

export async function buildMarketReport(db,workspaceId,researchId){
 const researchResult=await db.query(
  "SELECT id,title,country,city,sector,objective,status,created_at,updated_at FROM researches WHERE workspace_id=$1 AND id=$2 AND status <> 'archived'",
  [workspaceId,researchId]
 );
 const research=researchResult.rows[0];
 if(!research)return null;

 const [summaryResult,competitorResult,priceResult,evidenceResult]=await Promise.all([
  db.query(`SELECT COUNT(*)::int AS total,
   COUNT(*) FILTER(WHERE observation_type='strength')::int AS strengths,
   COUNT(*) FILTER(WHERE observation_type='weakness')::int AS weaknesses,
   COUNT(*) FILTER(WHERE observation_type='promotion')::int AS promotions,
   COUNT(*) FILTER(WHERE observation_type='customer_experience')::int AS customer_experiences,
   COUNT(*) FILTER(WHERE observation_type='strategy')::int AS strategies,
   COUNT(*) FILTER(WHERE observation_type='opportunity')::int AS opportunities,
   COUNT(*) FILTER(WHERE observation_type='risk')::int AS risks,
   COUNT(*) FILTER(WHERE source_url IS NOT NULL)::int AS sourced,
   MAX(observed_on) AS last_observed_on
   FROM market_observations WHERE workspace_id=$1 AND research_id=$2`,[workspaceId,researchId]),
  db.query(`SELECT c.id,c.name,c.website_url,c.location,c.description,
   COUNT(DISTINCT o.id)::int AS observations,
   COUNT(DISTINCT o.id) FILTER(WHERE o.observation_type='strength')::int AS strengths,
   COUNT(DISTINCT o.id) FILTER(WHERE o.observation_type='weakness')::int AS weaknesses,
   COUNT(DISTINCT o.id) FILTER(WHERE o.observation_type='promotion')::int AS promotions,
   COUNT(DISTINCT o.id) FILTER(WHERE o.observation_type='risk')::int AS risks,
   COUNT(DISTINCT o.id) FILTER(WHERE o.observation_type='opportunity')::int AS opportunities,
   COUNT(DISTINCT p.id)::int AS products,
   COALESCE(array_agg(DISTINCT p.name) FILTER(WHERE p.id IS NOT NULL),ARRAY[]::text[]) AS product_names,
   MAX(o.observed_on) AS last_observed_on
   FROM competitors c
   LEFT JOIN market_observations o
    ON o.workspace_id=c.workspace_id AND o.competitor_id=c.id AND o.research_id=$2
   LEFT JOIN market_products p
    ON p.workspace_id=c.workspace_id AND p.competitor_id=c.id AND p.research_id=$2 AND p.status='active'
   WHERE c.workspace_id=$1 AND c.status='active'
    AND (o.id IS NOT NULL OR p.id IS NOT NULL)
   GROUP BY c.id,c.name,c.website_url,c.location,c.description
   ORDER BY observations DESC,c.name`,[workspaceId,researchId]),
  db.query(`SELECT p.id AS product_id,p.name AS product_name,p.category,c.name AS competitor_name,
   po.currency,COUNT(po.id)::int AS observations,
   COUNT(po.id) FILTER(WHERE po.source_url IS NOT NULL)::int AS sourced_observations,
   MIN(po.price)::numeric AS min_price,MAX(po.price)::numeric AS max_price,
   AVG(po.price)::numeric(14,2) AS average_price,
   (ARRAY_AGG(po.price ORDER BY po.observed_on DESC,po.created_at DESC) FILTER(WHERE po.id IS NOT NULL))[1] AS latest_price,
   MAX(po.observed_on) AS last_observed_on,
   (SELECT COALESCE(jsonb_agg(jsonb_build_object(
     'id',recent.id,'price',recent.price,'currency',recent.currency,
     'observedOn',recent.observed_on,'sourceName',recent.source_name,
     'sourceUrl',recent.source_url,'notes',recent.notes
    ) ORDER BY recent.observed_on DESC,recent.created_at DESC),'[]'::jsonb)
    FROM (
     SELECT po2.id,po2.price,po2.currency,po2.observed_on,po2.source_name,po2.source_url,po2.notes,po2.created_at
     FROM price_observations po2
     WHERE po2.workspace_id=p.workspace_id AND po2.product_id=p.id AND po2.currency=po.currency
     ORDER BY po2.observed_on DESC,po2.created_at DESC LIMIT $3
    ) recent) AS price_evidence
   FROM market_products p
   LEFT JOIN competitors c ON c.id=p.competitor_id AND c.workspace_id=p.workspace_id
   LEFT JOIN price_observations po ON po.workspace_id=p.workspace_id AND po.product_id=p.id
   WHERE p.workspace_id=$1 AND p.research_id=$2 AND p.status='active'
   GROUP BY p.id,p.name,p.category,c.name,po.currency
   ORDER BY p.name,po.currency`,[workspaceId,researchId,PRICE_EVIDENCE_LIMIT]),
  db.query(`SELECT o.id,o.observation_type,o.title,o.content,o.source_name,o.source_url,
   o.observed_on,o.confidence,o.recorded_by,o.created_at,c.name AS competitor_name
   FROM market_observations o
   LEFT JOIN competitors c ON c.id=o.competitor_id AND c.workspace_id=o.workspace_id
   WHERE o.workspace_id=$1 AND o.research_id=$2
   ORDER BY o.observed_on DESC,o.created_at DESC LIMIT $3`,[workspaceId,researchId,EVIDENCE_LIMIT])
 ]);

 const summary=summaryResult.rows[0]??{};
 const total=Number(summary.total??0);
 const sourced=Number(summary.sourced??0);
 const observations=evidenceResult.rows;
 const priceObservationCount=priceResult.rows.reduce((sum,item)=>sum+Number(item.observations??0),0);
 const sourcedPriceObservationCount=priceResult.rows.reduce((sum,item)=>sum+Number(item.sourced_observations??0),0);
 const opportunities=observations.filter(item=>item.observation_type==="opportunity");
 const risks=observations.filter(item=>item.observation_type==="risk");
 const recommendations=[];

 if(!total)recommendations.push({priority:"high",text:"Registrar observaciones de mercado verificables antes de formular conclusiones."});
 if(total>0&&sourced<total)recommendations.push({priority:"high",text:`Completar fuentes verificables para ${total-sourced} observaciones sin enlace registrado.`});
 if(Number(summary.opportunities)>0)recommendations.push({priority:"review",text:"Validar las oportunidades registradas con demanda, costes y capacidad operativa."});
 if(Number(summary.risks)>0)recommendations.push({priority:"high",text:"Evaluar los riesgos registrados y definir responsables y medidas de respuesta."});
 if(priceObservationCount===0)recommendations.push({priority:"review",text:"Registrar precios observados con fecha, moneda y fuente para habilitar comparaciones."});
 if(priceObservationCount>0&&sourcedPriceObservationCount<priceObservationCount)recommendations.push({priority:"review",text:`Completar fuentes enlazadas para ${priceObservationCount-sourcedPriceObservationCount} registros de precios.`});

 const priceGroups={};
 for(const item of priceResult.rows){
  if(!item.currency||Number(item.observations)===0)continue;
  (priceGroups[item.currency]??=[]).push({
   ...item,
   min_price:money(item.min_price),
   max_price:money(item.max_price),
   average_price:money(item.average_price),
   latest_price:money(item.latest_price),
   price_evidence:item.price_evidence??[]
  });
 }
 const priceComparisons=Object.entries(priceGroups).map(([currency,items])=>({
  currency,items,
  comparableProducts:items.filter(item=>item.latest_price!==null).length,
  comparisonNote:"Los valores se agrupan por moneda. La comparabilidad comercial entre productos requiere revisar presentación, calidad, tamaño y condiciones."
 }));

 const evidenceTruncated=total>observations.length;
 const executiveSummary=total===0
  ?"La investigación todavía no contiene observaciones registradas. No hay evidencia suficiente para emitir conclusiones de mercado."
  :`Se registraron ${total} observaciones, ${sourced} con enlace de fuente, y ${priceObservationCount} registros de precios. Se identificaron ${Number(summary.opportunities??0)} oportunidades y ${Number(summary.risks??0)} riesgos documentados. Los resultados describen únicamente la información cargada.`;

 return {
  reportSchemaVersion:1,
  generatedAt:new Date().toISOString(),
  research,
  executiveSummary,
  indicators:{
   observations:total,
   sourcedObservations:sourced,
   sourceCoveragePercent:total?Math.round(sourced/total*100):0,
   opportunities:Number(summary.opportunities??0),
   risks:Number(summary.risks??0),
   lastObservedOn:summary.last_observed_on??null,
   evidenceReturned:observations.length,
   evidenceTruncated,
   priceObservations:priceObservationCount,
   sourcedPriceObservations:sourcedPriceObservationCount,
   priceSourceCoveragePercent:priceObservationCount?Math.round(sourcedPriceObservationCount/priceObservationCount*100):0
  },
  competitorAnalysis:competitorResult.rows,
  priceComparisons,
  opportunities,
  risks,
  evidence:observations,
  evidenceLimits:{observations:EVIDENCE_LIMIT,pricePointsPerProductAndCurrency:PRICE_EVIDENCE_LIMIT},
  conclusions:total
   ?["Los hallazgos se limitan a las observaciones y fuentes registradas.","Las diferencias de precios solo se presentan dentro de la misma moneda."]
   :["Información insuficiente para establecer conclusiones."],
  recommendations,
  methodology:"Informe descriptivo generado a partir de los registros de esta investigación. No realiza predicciones ni verifica de forma independiente las fuentes externas. La cobertura de fuentes cuenta únicamente observaciones con URL. Se muestran hasta 200 observaciones recientes y hasta 25 registros de precio recientes por producto y moneda; los indicadores agregados consideran el total de registros.",
  limitations:[
   "La presencia de una URL no garantiza que el contenido siga disponible ni que sea correcto.",
   "La comparación de precios no ajusta diferencias de tamaño, calidad, impuestos, envío o condiciones comerciales.",
   "Los datos faltantes no deben interpretarse como ausencia de competidores, riesgos u oportunidades.",
   "Las listas de evidencias pueden estar limitadas; los indicadores agregados informan el total registrado."
  ]
 };
}
