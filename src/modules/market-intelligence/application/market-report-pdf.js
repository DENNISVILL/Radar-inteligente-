import PDFDocument from "pdfkit";

const clean = value => value === null || value === undefined || value === "" ? "No registrado" : String(value);
const money = (value,currency) => value === null || value === undefined ? "—" : new Intl.NumberFormat("es-EC",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value));
const date = value => {
 if(!value)return "No registrada";
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?String(value):new Intl.DateTimeFormat("es-EC",{dateStyle:"medium",timeZone:"UTC"}).format(parsed);
};

function addSection(doc,title){
 if(doc.y>690)doc.addPage();
 doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor("#174A5B").text(title);
 doc.moveDown(0.35).font("Helvetica").fontSize(9).fillColor("#263238");
}
function addParagraph(doc,label,value){
 doc.font("Helvetica-Bold").text(label,{continued:true}).font("Helvetica").text(" "+clean(value),{paragraphGap:3});
}
function addBullet(doc,value){
 doc.font("Helvetica").fontSize(9).fillColor("#263238").text("• "+clean(value),{indent:8,paragraphGap:3});
}

export function generateMarketReportPdf(report,metadata={}){
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({bufferPages:true,size:"A4",margins:{top:48,bottom:48,left:52,right:52},info:{
   Title:"Informe de inteligencia comercial",
   Subject:clean(report?.research?.title),
   Author:"Radar Comercial",
   Keywords:"investigación comercial, competidores, precios, evidencias"
  }});
  const chunks=[];
  doc.on("data",chunk=>chunks.push(chunk));
  doc.on("error",reject);
  doc.on("end",()=>resolve(Buffer.concat(chunks)));
  const research=report?.research??{};
  const indicators=report?.indicators??{};
  doc.rect(0,0,doc.page.width,150).fill("#123B4A");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10).text("RADAR COMERCIAL",{continued:false});
  doc.moveDown(1.2).fontSize(23).text("Informe de inteligencia comercial",{width:480});
  doc.moveDown(0.5).font("Helvetica").fontSize(11).text(clean(research.title));
  doc.moveDown(0.35).fontSize(9).fillColor("#D7E7EC").text([research.city,research.country,research.sector].filter(Boolean).join(" · ")||"Investigación de mercado");
  doc.y=175;doc.fillColor("#263238");
  addParagraph(doc,"Objetivo:",research.objective);
  addParagraph(doc,"Estado de investigación:",research.status);
  addParagraph(doc,"Versión del snapshot:",metadata.version);
  addParagraph(doc,"Generado:",date(metadata.generated_at??report.generatedAt));
  addParagraph(doc,"Identificador:",metadata.id);
  addParagraph(doc,"Huella SHA-256:",metadata.report_hash);
  addSection(doc,"Resumen ejecutivo");
  doc.text(clean(report.executiveSummary),{align:"justify",lineGap:2});
  addSection(doc,"Indicadores");
  const metrics=[
   ["Observaciones",indicators.observations],["Observaciones con URL",indicators.sourcedObservations],
   ["Cobertura de fuentes",indicators.sourceCoveragePercent===undefined?undefined:indicators.sourceCoveragePercent+"%"],
   ["Oportunidades",indicators.opportunities],["Riesgos",indicators.risks],
   ["Registros de precios",indicators.priceObservations],["Precios con URL",indicators.sourcedPriceObservations],
   ["Última observación",date(indicators.lastObservedOn)]
  ];
  for(const [label,value] of metrics)addParagraph(doc,label+":",value);
  addSection(doc,"Comparativa de competidores");
  const competitors=report.competitorAnalysis??[];
  if(!competitors.length)addBullet(doc,"No hay competidores con datos asociados a esta investigación.");
  for(const item of competitors){
   if(doc.y>710)doc.addPage();
   doc.font("Helvetica-Bold").text(clean(item.name));
   doc.font("Helvetica").text("Ubicación: "+clean(item.location)+" · Observaciones: "+clean(item.observations)+" · Productos: "+clean(item.products));
   if(item.website_url)doc.fillColor("#146B8A").text(item.website_url,{link:item.website_url}).fillColor("#263238");
   if(item.description)doc.text(clean(item.description));
   doc.moveDown(0.35);
  }
  addSection(doc,"Comparativa de precios");
  const groups=report.priceComparisons??[];
  if(!groups.length)addBullet(doc,"No hay precios registrados para comparar.");
  for(const group of groups){
   if(doc.y>700)doc.addPage();
   doc.font("Helvetica-Bold").text("Moneda: "+clean(group.currency));
   for(const item of group.items??[]){
    if(doc.y>730)doc.addPage();
    doc.font("Helvetica-Bold").text(clean(item.product_name),{continued:true}).font("Helvetica").text(" · "+clean(item.competitor_name));
    doc.text("Mínimo: "+money(item.min_price,group.currency)+" | Máximo: "+money(item.max_price,group.currency)+" | Promedio: "+money(item.average_price,group.currency)+" | Último: "+money(item.latest_price,group.currency));
    for(const point of (item.price_evidence??[]).slice(0,25)){
     const detail="  "+date(point.observedOn)+" · "+money(point.price,point.currency)+" · "+clean(point.sourceName);
     doc.fontSize(8).text(detail);
     if(point.sourceUrl)doc.fillColor("#146B8A").text(point.sourceUrl,{link:point.sourceUrl}).fillColor("#263238");
    }
    doc.moveDown(0.3);
   }
  }
  addSection(doc,"Oportunidades y riesgos");
  for(const item of report.opportunities??[])addBullet(doc,"Oportunidad: "+(item.title??item.content??item.id));
  for(const item of report.risks??[])addBullet(doc,"Riesgo: "+(item.title??item.content??item.id));
  if(!(report.opportunities?.length||report.risks?.length))addBullet(doc,"No hay oportunidades ni riesgos documentados en las evidencias devueltas.");
  addSection(doc,"Evidencias y trazabilidad");
  const evidence=report.evidence??[];
  if(!evidence.length)addBullet(doc,"No hay observaciones disponibles.");
  for(const item of evidence){
   if(doc.y>720)doc.addPage();
   doc.font("Helvetica-Bold").text(clean(item.title??item.observation_type));
   doc.font("Helvetica").text(clean(item.content),{align:"justify"});
   doc.text("Tipo: "+clean(item.observation_type)+" · Fecha: "+date(item.observed_on)+" · Confianza: "+clean(item.confidence));
   doc.text("Fuente: "+clean(item.source_name)+" · Registrado por: "+clean(item.recorded_by));
   if(item.source_url)doc.fillColor("#146B8A").text(item.source_url,{link:item.source_url}).fillColor("#263238");
   doc.moveDown(0.35);
  }
  if(report.indicators?.evidenceTruncated)addBullet(doc,"La lista de evidencias está limitada; los indicadores agregados reflejan el total de registros.");
  addSection(doc,"Recomendaciones");
  for(const item of report.recommendations??[])addBullet(doc,clean(item.priority).toUpperCase()+": "+item.text);
  if(!report.recommendations?.length)addBullet(doc,"No se generaron recomendaciones automáticas.");
  addSection(doc,"Metodología y limitaciones");
  doc.text(clean(report.methodology),{align:"justify"});
  for(const item of report.limitations??[])addBullet(doc,item);
  doc.moveDown(0.7).fontSize(8).fillColor("#607D8B").text("Documento descriptivo basado en los datos registrados en Radar Comercial. La inclusión de una URL no implica verificación independiente de su contenido.",{align:"justify"});
  const range=doc.bufferedPageRange();
  for(let i=0;i<range.count;i++){
   doc.switchToPage(i);
   doc.font("Helvetica").fontSize(8).fillColor("#607D8B").text("Radar Comercial · "+clean(research.title)+" · Página "+(i+1)+" de "+range.count,52,doc.page.height-32,{width:doc.page.width-104,align:"center"});
  }
  doc.end();
 });
}
