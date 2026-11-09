import {buildMarketSuggestions} from "../domain/market-analysis.js";

/**
 * Reads workspace- and research-scoped records and builds a descriptive report.
 * All values are observations; suggestions are review prompts, never forecasts.
 */
export async function getMarketAnalysis(db, workspaceId, researchId) {
  const [competitors, products, signals] = await Promise.all([
    db.query(`SELECT c.id AS competitor_id,c.name,
      COUNT(o.id)::int AS observations_count,
      COUNT(o.id) FILTER (WHERE o.observation_type='strength')::int AS strengths_count,
      COUNT(o.id) FILTER (WHERE o.observation_type='weakness')::int AS weaknesses_count,
      COUNT(o.id) FILTER (WHERE o.observation_type='promotion')::int AS promotions_count,
      COUNT(o.id) FILTER (WHERE o.observation_type='risk')::int AS risks_count,
      COUNT(o.id) FILTER (WHERE o.observation_type='opportunity')::int AS opportunities_count,
      MAX(o.observed_on) AS last_observed_on
      FROM competitors c LEFT JOIN market_observations o
        ON o.competitor_id=c.id AND o.workspace_id=c.workspace_id AND o.research_id=$2
      WHERE c.workspace_id=$1 AND c.status='active'
      GROUP BY c.id,c.name ORDER BY observations_count DESC,c.name`, [workspaceId,researchId]),
    db.query(`SELECT p.id AS product_id,p.competitor_id,c.name AS competitor_name,p.name AS product_name,p.category,
      po.currency,COUNT(po.id)::int AS price_points,MIN(po.price)::numeric AS min_price,
      MAX(po.price)::numeric AS max_price,AVG(po.price)::numeric(14,2) AS average_price,
      (ARRAY_AGG(po.price ORDER BY po.observed_on DESC,po.created_at DESC) FILTER (WHERE po.id IS NOT NULL))[1] AS latest_price,
      MAX(po.observed_on) AS last_price_date
      FROM market_products p LEFT JOIN competitors c ON c.id=p.competitor_id AND c.workspace_id=p.workspace_id
      LEFT JOIN price_observations po ON po.product_id=p.id AND po.workspace_id=p.workspace_id
      WHERE p.workspace_id=$1 AND p.research_id=$2 AND p.status='active'
      GROUP BY p.id,p.competitor_id,c.name,p.name,p.category,po.currency ORDER BY p.name,po.currency`, [workspaceId,researchId]),
    db.query(`SELECT COUNT(*)::int AS total_observations,
      COUNT(*) FILTER (WHERE observation_type='strength')::int AS strengths,
      COUNT(*) FILTER (WHERE observation_type='weakness')::int AS weaknesses,
      COUNT(*) FILTER (WHERE observation_type='promotion')::int AS promotions,
      COUNT(*) FILTER (WHERE observation_type='customer_experience')::int AS customer_experiences,
      COUNT(*) FILTER (WHERE observation_type='strategy')::int AS strategies,
      COUNT(*) FILTER (WHERE observation_type='opportunity')::int AS opportunities,
      COUNT(*) FILTER (WHERE observation_type='risk')::int AS risks,
      COUNT(*) FILTER (WHERE source_url IS NOT NULL)::int AS sourced_observations,
      MAX(observed_on) AS last_observed_on
      FROM market_observations WHERE workspace_id=$1 AND research_id=$2`, [workspaceId,researchId])
  ]);
  const summary = signals.rows[0] ?? {};
  return {
    summary,
    competitors: competitors.rows,
    products: products.rows,
    suggestions: buildMarketSuggestions(summary, products.rows),
    methodology: "Análisis descriptivo basado únicamente en los registros guardados en esta investigación. Las sugerencias son reglas de revisión, no predicciones ni conclusiones automáticas sobre el mercado."
  };
}
