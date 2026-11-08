import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("report snapshots migration enforces workspace scope and version uniqueness",async()=>{
 const sql=await readFile(new URL("../../../database/migrations/006_market_reports.sql",import.meta.url),"utf8");
 assert.match(sql,/FOREIGN KEY\s*\(research_id,workspace_id\)\s*REFERENCES researches\(id,workspace_id\)/i);
 assert.match(sql,/UNIQUE\s*\(workspace_id,research_id,version\)/i);
 assert.match(sql,/report_data JSONB NOT NULL/i);
});

test("snapshot integrity migration hashes JSONB and prevents updates",async()=>{
 const sql=await readFile(new URL("../../../database/migrations/008_market_report_integrity.sql",import.meta.url),"utf8");
 assert.match(sql,/digest\(report_data::text,'sha256'\)/i);
 assert.match(sql,/report_hash CHAR\(64\)/i);
 assert.match(sql,/BEFORE INSERT ON market_reports/i);
 assert.match(sql,/BEFORE UPDATE ON market_reports/i);
 assert.match(sql,/Market report snapshots are immutable/i);
});

test("report routes expose snapshot creation, history and retrieval with integrity verification",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 assert.ok(source.includes('app.post(base+"/reports"'));
 assert.ok(source.includes('app.get(base+"/reports"'));
 assert.ok(source.includes('app.get(base+"/reports/:reportId"'));
 assert.match(source,/report_hash/);
 assert.match(source,/integrity_verified/);
 assert.match(source,/workspace_id=\$1 AND research_id=\$2 AND id=\$3/);
});

test("snapshot creation requires a writer role and stores the internal user id",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 assert.match(source,/const writers=\["owner","admin","analyst"\]/);
 assert.match(source,/authorize\(r,p,o,true\)/);
 assert.match(source,/ensureIdentityUser\(o\.database,r\.identity\)/);
 assert.match(source,/JSON\.stringify\(report\),user\.id/);
});

test("audit log migration is workspace scoped and indexed",async()=>{
 const sql=await readFile(new URL("../../../database/migrations/007_audit_logs.sql",import.meta.url),"utf8");
 assert.match(sql,/workspace_id UUID NOT NULL REFERENCES workspaces\(id\)/i);
 assert.match(sql,/actor_user_id UUID REFERENCES users\(id\)/i);
 assert.match(sql,/metadata JSONB NOT NULL/i);
 assert.match(sql,/idx_audit_logs_workspace_created/i);
});

test("snapshot and audit event are written in the same explicit transaction",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 const auditRead=await readFile(new URL("../../../src/modules/market-intelligence/application/workspace-audit-logs.js",import.meta.url),"utf8");
 assert.match(source,/market_report\.snapshot_created/);
 assert.match(source,/INSERT INTO audit_logs\(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata\)/);
 assert.match(source,/listWorkspaceAuditLogs\(o\.database/);
 assert.match(auditRead,/\["owner","admin"\]\.includes\(membership\.rows\[0\]\.role\)/);
 assert.match(auditRead,/FROM audit_logs\s+WHERE workspace_id=\$1/);
 const begin=source.indexOf('await client.query("BEGIN")');
 const build=source.indexOf("buildMarketReport(client");
 const snapshot=source.indexOf("INSERT INTO market_reports");
 const audit=source.indexOf("INSERT INTO audit_logs");
 const commit=source.indexOf('await client.query("COMMIT")');
 const rollback=source.lastIndexOf('await client.query("ROLLBACK")');
 assert.ok(begin>=0&&begin<build&&build<snapshot&&snapshot<audit&&audit<commit,"report data, snapshot and audit must share one consistent transaction");
 assert.ok(rollback>commit,"transaction must provide rollback handling");
});

test("snapshot versioning serializes workspace writes and rechecks membership before reading report data",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 assert.match(source,/pg_advisory_lock\(hashtextextended/);
 assert.match(source,/SELECT id FROM workspaces WHERE id=\$1 AND status='active' FOR UPDATE/);
 assert.match(source,/FOR UPDATE OF wm/);
 assert.match(source,/BEGIN/);
 assert.match(source,/SELECT COALESCE\(MAX\(version\),0\)\+1 AS version/);
 assert.match(source,/pg_advisory_unlock\(hashtextextended/);
 assert.match(source,/client\.release\(releaseError\)/);
});
