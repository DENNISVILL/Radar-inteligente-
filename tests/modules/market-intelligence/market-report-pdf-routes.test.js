import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {marketReportRoutes} from "../../../src/modules/market-intelligence/presentation/market-report.routes.js";

const workspaceId="11111111-1111-4111-8111-111111111111";
const researchId="22222222-2222-4222-8222-222222222222";
const reportId="33333333-3333-4333-8333-333333333333";
const snapshot={
 id:reportId,version:1,generated_at:"2026-11-07T12:00:00.000Z",
 report_hash:"a".repeat(64),integrity_verified:true,
 report_data:{
  research:{title:"Informe de prueba",country:"Ecuador",sector:"Servicios"},
  executiveSummary:"Informe de prueba generado desde un snapshot.",
  indicators:{observations:0,sourcedObservations:0,opportunities:0,risks:0},
  competitorAnalysis:[],priceComparisons:[],opportunities:[],risks:[],
  evidence:[],recommendations:[],methodology:"Método descriptivo.",limitations:[]
 }
};

async function buildTestApp({membership=true,integrity=true}={}){
 const calls=[];
 const database={query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.includes("FROM workspace_members wm"))return {rows:membership?[{workspace_id:workspaceId,role:"viewer"}]:[]};
  if(sql.includes("FROM market_reports WHERE workspace_id=$1 AND research_id=$2 AND id=$3"))return {rows:[{...snapshot,integrity_verified:integrity}]};
  throw new Error("Unexpected database query: "+sql);
 }};
 const app=Fastify({logger:false});
 await app.register(marketReportRoutes,{
  database,
  requireIdentity:async request=>{request.identity={subject:"auth-user"};}
 });
 await app.ready();
 return {app,calls};
}

test("PDF endpoint returns an attachment for an authorized member and verified snapshot",async()=>{
 const {app,calls}=await buildTestApp();
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/researches/${researchId}/reports/${reportId}/pdf`});
  assert.equal(response.statusCode,200);
  assert.match(response.headers["content-type"],/application\/pdf/);
  assert.match(response.headers["content-disposition"],/attachment; filename="radar-/);
  assert.equal(response.rawPayload.subarray(0,5).toString("ascii"),"%PDF-");
  assert.equal(calls.length,2);
 }finally{await app.close();}
});

test("PDF endpoint denies users without workspace membership before reading a snapshot",async()=>{
 const {app,calls}=await buildTestApp({membership:false});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/researches/${researchId}/reports/${reportId}/pdf`});
  assert.equal(response.statusCode,403);
  assert.equal(response.json().error,"FORBIDDEN");
  assert.equal(calls.length,1);
 }finally{await app.close();}
});

test("PDF endpoint rejects a snapshot whose integrity check fails",async()=>{
 const {app}=await buildTestApp({integrity:false});
 try{
  const response=await app.inject({method:"GET",url:`/api/v1/workspaces/${workspaceId}/researches/${researchId}/reports/${reportId}/pdf`});
  assert.equal(response.statusCode,409);
  assert.equal(response.json().error,"REPORT_INTEGRITY_FAILED");
 }finally{await app.close();}
});
