import test from "node:test";
import assert from "node:assert/strict";
import {getMarketAnalysis} from "../../../src/modules/market-analysis/application/market-analysis.js";

test("loads analysis with both workspace and research scope on every query",async()=>{
 const calls=[];
 const db={query:async(sql,values)=>{calls.push({sql,values});if(sql.includes("FROM competitors c"))return {rows:[{competitor_id:"c1",name:"Local"}]};if(sql.includes("FROM market_products p"))return {rows:[{product_id:"p1",currency:"USD",latest_price:"3.00"},{product_id:"p2",currency:"USD",latest_price:"4.00"}]};return {rows:[{total_observations:2,weaknesses:1,opportunities:1,risks:0,sourced_observations:1}]};}};
 const result=await getMarketAnalysis(db,"workspace-A","research-B");
 assert.equal(calls.length,3);
 for(const call of calls)assert.deepEqual(call.values,["workspace-A","research-B"]);
 assert.equal(result.competitors.length,1);
 assert.ok(result.suggestions.some(x=>x.code==="RECORDED_OPPORTUNITIES"));
 assert.ok(result.suggestions.some(x=>x.code==="SOURCE_COVERAGE"));
 assert.match(result.methodology,/no predicciones/);
});
