export function createRateLimiter({
 maxRequests=120,
 authMaxRequests=10,
 windowMs=60_000,
 now=Date.now,
 maxBuckets=10_000
}={}){
 const buckets=new Map();
 return async function rateLimit(request,reply){
  const route=request.routeOptions?.url??request.url?.split("?")[0]??"/";
  if(route==="/health"||route==="/ready")return;
  const limit=route==="/api/v1/invitations/accept"?authMaxRequests:maxRequests;
  const key=`${request.ip??"unknown"}:${route}`;
  const time=now();
  let bucket=buckets.get(key);
  if(!bucket||time>=bucket.resetAt){
   bucket={count:0,resetAt:time+windowMs};
   buckets.set(key,bucket);
  }
  bucket.count+=1;
  const remaining=Math.max(0,limit-bucket.count);
  const resetSeconds=Math.max(1,Math.ceil((bucket.resetAt-time)/1000));
  reply.header("RateLimit-Limit",String(limit));
  reply.header("RateLimit-Remaining",String(remaining));
  reply.header("RateLimit-Reset",String(resetSeconds));
  if(bucket.count>limit){
   reply.header("Retry-After",String(resetSeconds));
   return reply.code(429).send({
    error:"RATE_LIMITED",
    message:"Se alcanzó el límite temporal de solicitudes. Inténtalo nuevamente más tarde."
   });
  }
  if(buckets.size>maxBuckets){
   for(const [bucketKey,value] of buckets){
    if(time>=value.resetAt)buckets.delete(bucketKey);
    if(buckets.size<=maxBuckets)break;
   }
   while(buckets.size>maxBuckets)buckets.delete(buckets.keys().next().value);
  }
 };
}
