import test from "node:test";
import assert from "node:assert/strict";
import {createRateLimiter} from "../../../src/infrastructure/http/rate-limit.js";
import {buildApp} from "../../../src/app.js";
import {loadConfig} from "../../../src/config/env.js";

function fakeReply(){
 return {
  statusCode:200,headers:{},payload:null,
  header(name,value){this.headers[name]=value;return this;},
  code(status){this.statusCode=status;return this;},
  send(payload){this.payload=payload;return this;}
 };
}

test("rate limiter applies independent fixed windows per IP and route",async()=>{
 let now=1_000;
 const limit=createRateLimiter({maxRequests:2,windowMs:10_000,now:()=>now});
 const request={ip:"192.0.2.1",routeOptions:{url:"/api/v1/me"}};
 let reply=fakeReply();
 await limit(request,reply);
 assert.equal(reply.statusCode,200);
 assert.equal(reply.headers["RateLimit-Remaining"],"1");
 reply=fakeReply();await limit(request,reply);
 assert.equal(reply.headers["RateLimit-Remaining"],"0");
 reply=fakeReply();await limit(request,reply);
 assert.equal(reply.statusCode,429);
 assert.equal(reply.payload.error,"RATE_LIMITED");
 reply=fakeReply();await limit({...request,ip:"192.0.2.2"},reply);
 assert.equal(reply.statusCode,200);
 reply=fakeReply();await limit({...request,routeOptions:{url:"/api/v1/workspaces"}},reply);
 assert.equal(reply.statusCode,200);
 now+=10_001;
 reply=fakeReply();await limit(request,reply);
 assert.equal(reply.statusCode,200);
});

test("invitation acceptance uses its stricter limit and returns Retry-After",async()=>{
 let now=5_000;
 const limit=createRateLimiter({maxRequests:50,authMaxRequests:1,windowMs:30_000,now:()=>now});
 const request={ip:"192.0.2.3",routeOptions:{url:"/api/v1/invitations/accept"}};
 let reply=fakeReply();await limit(request,reply);
 assert.equal(reply.headers["RateLimit-Limit"],"1");
 reply=fakeReply();await limit(request,reply);
 assert.equal(reply.statusCode,429);
 assert.equal(reply.headers["Retry-After"],"30");
});

test("health and readiness endpoints are excluded from rate limiting",async()=>{
 const limit=createRateLimiter({maxRequests:1});
 for(const url of ["/health","/ready"]){
  const reply=fakeReply();
  await limit({ip:"127.0.0.1",routeOptions:{url}},reply);
  assert.equal(reply.statusCode,200);
  assert.deepEqual(reply.headers,{});
 }
});

test("Fastify enforces the configured rate limit before protected route handlers",async()=>{
 const config=loadConfig({RATE_LIMIT_MAX:"1",RATE_LIMIT_AUTH_MAX:"1"});
 const app=buildApp({config,database:{async query(){return {rows:[]};}},logger:false});
 try{
  const first=await app.inject({method:"GET",url:"/api/v1/me"});
  assert.equal(first.statusCode,503);
  const second=await app.inject({method:"GET",url:"/api/v1/me"});
  assert.equal(second.statusCode,429);
  assert.equal(second.json().error,"RATE_LIMITED");
 }finally{await app.close();}
});
