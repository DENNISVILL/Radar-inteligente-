/**
 * Pure, deterministic interpretation of recorded market evidence.
 * No network, database or prediction model is used in this layer.
 */
const count = value => Number(value ?? 0);

export function buildMarketSuggestions(summary = {}, products = []) {
  const suggestions = [];
  if (count(summary.weaknesses) > 0) suggestions.push({code:"COMPETITOR_WEAKNESSES",priority:"review",title:"Revisar debilidades detectadas",detail:`Se registraron ${count(summary.weaknesses)} observaciones de debilidad. Contrástalas con fuentes y necesidades de clientes.`});
  if (count(summary.promotions) > 0) suggestions.push({code:"PROMOTION_PRESSURE",priority:"review",title:"Evaluar presión promocional",detail:`Hay ${count(summary.promotions)} observaciones de promociones. Compara su vigencia, condiciones y precios antes de reaccionar.`});
  if (count(summary.opportunities) > 0) suggestions.push({code:"RECORDED_OPPORTUNITIES",priority:"high",title:"Validar oportunidades registradas",detail:`Hay ${count(summary.opportunities)} oportunidades anotadas. Priorízalas según demanda, coste y capacidad operativa.`});
  if (count(summary.risks) > 0) suggestions.push({code:"RECORDED_RISKS",priority:"high",title:"Revisar riesgos identificados",detail:`Se registraron ${count(summary.risks)} riesgos que conviene evaluar y asignar a un responsable.`});

  const byCurrency = new Map();
  for (const product of products) {
    if (product.latest_price === null || product.latest_price === undefined || !product.currency) continue;
    const group = byCurrency.get(product.currency) ?? [];
    group.push(product);
    byCurrency.set(product.currency, group);
  }
  for (const [currency, items] of byCurrency) {
    if (items.length < 2) continue;
    const prices = items.map(item => Number(item.latest_price)).filter(Number.isFinite).sort((a,b)=>a-b);
    if (prices.length < 2) continue;
    suggestions.push({code:"PRICE_SPREAD",priority:"review",title:`Comparar precios registrados (${currency})`,detail:`Entre los ${prices.length} productos con precios observados en ${currency}, el menor último precio es ${prices[0]} y el mayor es ${prices.at(-1)} ${currency}. Verifica que sean productos comparables.`});
  }
  if (count(summary.total_observations) > 0 && count(summary.sourced_observations) < count(summary.total_observations)) {
    const missing = count(summary.total_observations) - count(summary.sourced_observations);
    suggestions.push({code:"SOURCE_COVERAGE",priority:"review",title:"Completar fuentes verificables",detail:`${missing} observaciones no tienen un enlace de fuente registrado.`});
  }
  return suggestions;
}
