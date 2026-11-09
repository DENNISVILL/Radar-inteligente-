import test from "node:test";
import assert from "node:assert/strict";
import {buildMarketSuggestions} from "../../../src/modules/market-analysis/domain/market-analysis.js";

test("creates evidence-review suggestions from opportunity and risk counts",()=>{
 const result=buildMarketSuggestions({weaknesses:"2",promotions:1,opportunities:3,risks:1,total_observations:8,sourced_observations:6},[]);
 assert.deepEqual(result.map(x=>x.code),["COMPETITOR_WEAKNESSES","PROMOTION_PRESSURE","RECORDED_OPPORTUNITIES","RECORDED_RISKS","SOURCE_COVERAGE"]);
 assert.match(result.find(x=>x.code==="SOURCE_COVERAGE").detail,/2 observaciones/);
});
test("compares latest prices only within the same currency",()=>{
 const result=buildMarketSuggestions({},[
  {currency:"USD",latest_price:"2.50"},{currency:"USD",latest_price:"4.00"},
  {currency:"EUR",latest_price:"1.00"},{currency:"EUR",latest_price:null},
  {currency:null,latest_price:"3.00"}
 ]);
 const spreads=result.filter(x=>x.code==="PRICE_SPREAD");
 assert.equal(spreads.length,1);
 assert.match(spreads[0].detail,/2 productos.*USD/);
});
test("does not create suggestions from empty evidence",()=>assert.deepEqual(buildMarketSuggestions({},[]),[]));
