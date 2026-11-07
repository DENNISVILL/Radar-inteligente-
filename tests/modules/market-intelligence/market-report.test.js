import test from "node:test";
import assert from "node:assert/strict";
import {buildMarketReport} from "../../../src/modules/market-intelligence/application/market-report.js";

test("returns null when research is not in the requested workspace",async()=>{
 const db={query:async()=>({rows:[]})};
 assert.equal(await buildMarketReport(db,"w1","r1"),null);
});

test("builds a traceable report and keeps price currencies separate",async()=>{
 const calls=[];
 const priceEvidence=[{id:"price-1",price:2,currency:"USD",observedOn:"2026-11-07",sourceName:"Store",sourceUrl:"https://example.com/price"}];
 const db={query:async(sql,values)=>{
  calls.push({sql,values});
  if(sql.includes("FROM researches"))return {rows:[{id:"r1",title:"Estudio",country:"Ecuador",sector:"Retail"}]};
  if(sql.includes("COUNT(*)::int AS total"))return {rows:[{total:2,sourced:1,opportunities:1,risks:0,last_observed_on:"2026-11-07"}]};
  if(sql.includes("FROM competitors c"))return {rows:[{id:"c1",name:"Local",observations:2,products:1,product_names:["A"]}]};
  if(sql.includes("FROM market_products p"))return {rows:[
   {product_id:"p1",product_name:"A",currency:"USD",observations:1,sourced_observations:1,min_price:"2",max_price:"2",average_price:"2",latest_price:"2",price_evidence:priceEvidence},
   {product_id:"p2",product_name:"B",currency:"EUR",observations:1,sourced_observations:0,min_price:"3",max_price:"3",average_price:"3",latest_price:"3",price_evidence:[]}
  ]};
  return {rows:[{id:"o1",observation_type:"opportunity",title:"Demanda",content:"Señal registrada",source_name:"Encuesta",source_url:"https://example.com",observed_on:"2026-11-07",confidence:"high",recorded_by:"u1"}]};
 }};
 const report=await buildMarketReport(db,"w1","r1");
 assert.equal(calls.length,5);
 assert.ok(calls.every(call=>call.values[0]==="w1"&&call.values[1]==="r1"));
 assert.equal(report.reportSchemaVersion,1);
 assert.equal(report.indicators.sourceCoveragePercent,50);
 assert.equal(report.priceComparisons.length,2);
 assert.deepEqual(report.priceComparisons.map(group=>group.currency).sort(),["EUR","USD"]);
 assert.deepEqual(report.priceComparisons.find(group=>group.currency==="USD").items[0].price_evidence,priceEvidence);
 assert.equal(report.indicators.priceObservations,2);
 assert.equal(report.indicators.sourcedPriceObservations,1);
 assert.equal(report.indicators.priceSourceCoveragePercent,50);
 assert.equal(report.opportunities.length,1);
 assert.ok(report.recommendations.some(item=>item.text.includes("fuentes verificables")));
 assert.ok(report.recommendations.some(item=>item.text.includes("registros de precios")));
 assert.match(calls.find(call=>call.sql.includes("FROM competitors c")).sql,/o\.id IS NOT NULL OR p\.id IS NOT NULL/);
});

test("reports truncation while retaining aggregate counts for all observations",async()=>{
 const evidence=Array.from({length:200},(_,index)=>({id:`o${index}`,observation_type:"risk",title:"Riesgo"}));
 const db={query:async(sql)=>{
  if(sql.includes("FROM researches"))return {rows:[{id:"r1",title:"Estudio"}]};
  if(sql.includes("COUNT(*)::int AS total"))return {rows:[{total:230,sourced:200,opportunities:4,risks:26}]};
  if(sql.includes("FROM competitors c"))return {rows:[]};
  if(sql.includes("FROM market_products p"))return {rows:[]};
  return {rows:evidence};
 }};
 const report=await buildMarketReport(db,"w1","r1");
 assert.equal(report.indicators.observations,230);
 assert.equal(report.indicators.risks,26);
 assert.equal(report.indicators.evidenceReturned,200);
 assert.equal(report.indicators.evidenceTruncated,true);
 assert.equal(report.risks.length,200);
 assert.equal(report.evidenceLimits.observations,200);
});

test("states when the research has insufficient observations",async()=>{
 const db={query:async(sql)=>{
  if(sql.includes("FROM researches"))return {rows:[{id:"r1",title:"Estudio"}]};
  if(sql.includes("COUNT(*)::int AS total"))return {rows:[{total:0,sourced:0,opportunities:0,risks:0}]};
  return {rows:[]};
 }};
 const report=await buildMarketReport(db,"w1","r1");
 assert.match(report.executiveSummary,/no contiene observaciones/);
 assert.match(report.conclusions[0],/Información insuficiente/);
 assert.ok(report.recommendations.some(item=>item.text.includes("Registrar precios")));
});
