import { randomBytes } from "node:crypto";

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

function traceContext(value) {
  const match = typeof value === "string" ? TRACEPARENT.exec(value) : null;
  const traceId = match && !/^0+$/.test(match[1]) ? match[1].toLowerCase() : randomBytes(16).toString("hex");
  const parentSpanId = match && !/^0+$/.test(match[2]) ? match[2].toLowerCase() : null;
  const spanId = randomBytes(8).toString("hex");
  return { traceId, parentSpanId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

function label(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function registerObservability(app, { metricsEnabled = true } = {}) {
  const counters = new Map();
  const histograms = new Map();
  let activeRequests = 0;

  app.addHook("onRequest", async (request, reply) => {
    const context = traceContext(request.headers.traceparent);
    request.radarTrace = context;
    request.radarStartedAt = process.hrtime.bigint();
    activeRequests += 1;
    reply.header("x-trace-id", context.traceId);
    reply.header("traceparent", context.traceparent);
  });

  app.addHook("onResponse", async (request, reply) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (request.url.split("?")[0] === "/metrics") return;

    const route = request.routeOptions?.url ?? "unmatched";
    const method = request.method;
    const status = String(reply.statusCode);
    const key = JSON.stringify([method, route, status]);
    const duration = Number(process.hrtime.bigint() - request.radarStartedAt) / 1e9;
    counters.set(key, (counters.get(key) ?? 0) + 1);

    const histogram = histograms.get(JSON.stringify([method, route])) ?? {
      count: 0, sum: 0, buckets: new Array(BUCKETS.length).fill(0)
    };
    histogram.count += 1;
    histogram.sum += duration;
    BUCKETS.forEach((bound, index) => { if (duration <= bound) histogram.buckets[index] += 1; });
    histograms.set(JSON.stringify([method, route]), histogram);

    request.log.info({
      trace_id: request.radarTrace.traceId,
      parent_span_id: request.radarTrace.parentSpanId,
      method,
      route,
      status_code: reply.statusCode,
      duration_ms: Number((duration * 1000).toFixed(3))
    }, "request completed");
  });

  if (metricsEnabled) {
    app.get("/metrics", async (_request, reply) => {
      const lines = [
        "# HELP radar_http_requests_total Total HTTP requests by method, route and status.",
        "# TYPE radar_http_requests_total counter"
      ];
      for (const [key, value] of counters) {
        const [method, route, status] = JSON.parse(key);
        lines.push(`radar_http_requests_total{method="${label(method)}",route="${label(route)}",status="${label(status)}"} ${value}`);
      }
      lines.push(
        "# HELP radar_http_request_duration_seconds HTTP request duration in seconds.",
        "# TYPE radar_http_request_duration_seconds histogram"
      );
      for (const [key, value] of histograms) {
        const [method, route] = JSON.parse(key);
        BUCKETS.forEach((bound, index) => {
          lines.push(`radar_http_request_duration_seconds_bucket{method="${label(method)}",route="${label(route)}",le="${bound}"} ${value.buckets[index]}`);
        });
        lines.push(`radar_http_request_duration_seconds_bucket{method="${label(method)}",route="${label(route)}",le="+Inf"} ${value.count}`);
        lines.push(`radar_http_request_duration_seconds_sum{method="${label(method)}",route="${label(route)}"} ${value.sum}`);
        lines.push(`radar_http_request_duration_seconds_count{method="${label(method)}",route="${label(route)}"} ${value.count}`);
      }
      lines.push(
        "# HELP radar_http_requests_active Current in-flight HTTP requests.",
        "# TYPE radar_http_requests_active gauge",
        `radar_http_requests_active ${activeRequests}`
      );
      return reply.type("text/plain; version=0.0.4; charset=utf-8").send(lines.join("\n") + "\n");
    });
  }
}
