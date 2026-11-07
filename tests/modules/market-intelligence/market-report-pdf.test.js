import test from "node:test";
import assert from "node:assert/strict";
import {generateMarketReportPdf} from "../../../src/modules/market-intelligence/application/market-report-pdf.js";

test("generates a readable PDF buffer with report and snapshot metadata",async()=>{
 const pdf=await generateMarketReportPdf({
  research:{title:"Estudio comercial",country:"Ecuador",sector:"Retail",objective:"Evaluar el mercado"},
  executiveSummary:"Resumen de prueba con observaciones documentadas.",
  indicators:{observations:3,sourcedObservations:2,sourceCoveragePercent:67,opportunities:1,risks:0,priceObservations:2,sourcedPriceObservations:2,lastObservedOn:"2026-11-07"},
  competitorAnalysis:[{name:"Competidor Uno",location:"Loja",observations:2,products:1,website_url:"https://example.com"}],
  priceComparisons:[{currency:"USD",items:[{product_name:"Producto A",competitor_name:"Competidor Uno",min_price:2,max_price:3,average_price:2.5,latest_price:3,price_evidence:[{price:3,currency:"USD",observedOn:"2026-11-07",sourceName:"Catálogo",sourceUrl:"https://example.com/price"}]}]}],
  opportunities:[{title:"Demanda no atendida"}],risks:[],evidence:[{title:"Observación",content:"Evidencia de ejemplo",observation_type:"opportunity",observed_on:"2026-11-07",source_name:"Entrevista",source_url:"https://example.com/source"}],
  recommendations:[{priority:"high",text:"Validar la demanda"}],methodology:"Método descriptivo.",limitations:["Las fuentes no se verifican independientemente."]
 },{id:"snapshot-123",version:2,generated_at:"2026-11-07T12:00:00Z",report_hash:"a".repeat(64)});
 assert.ok(Buffer.isBuffer(pdf));
 assert.equal(pdf.subarray(0,8).toString("ascii").startsWith("%PDF-"),true);
 assert.ok(pdf.length>1500);
});

test("generates a PDF for an empty report without inventing findings",async()=>{
 const pdf=await generateMarketReportPdf({research:{title:"Sin datos"},executiveSummary:"Sin observaciones.",indicators:{observations:0},competitorAnalysis:[],priceComparisons:[],evidence:[],opportunities:[],risks:[],recommendations:[],limitations:[]},{});
 assert.equal(pdf.subarray(0,5).toString("ascii"),"%PDF-");
});
