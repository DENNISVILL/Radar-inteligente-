import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("report snapshots migration enforces workspace scope and immutable version uniqueness",async()=>{
 const sql=await readFile(new URL("../../../database/migrations/006_market_reports.sql",import.meta.url),"utf8");
 assert.match(sql,/FOREIGN KEY\s*\(research_id,workspace_id\)\s*REFERENCES researches\(id,workspace_id\)/i);
 assert.match(sql,/UNIQUE\s*\(workspace_id,research_id,version\)/i);
 assert.match(sql,/report_data JSONB NOT NULL/i);
});
test("report routes expose snapshot creation, history and retrieval",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 assert.match(source,/app\.post\(base\+"\/reports"/);
 assert.match(source,/app\.get\(base\+"\/reports"/);
 assert.match(source,/app\.get\(base\+"\/reports\/:reportId"/);
 assert.match(source,/pg_advisory_xact_lock/);
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
test("snapshot writes an audit event atomically and exposes restricted audit history",async()=>{
 const source=await readFile(new URL("../../../src/modules/market-intelligence/presentation/market-report.routes.js",import.meta.url),"utf8");
 assert.match(source,/audit_event AS \(/);
 assert.match(source,/market_report\.snapshot_created/);
 assert.match(source,/CROSS JOIN audit_event/);
 assert.match(source,/canAccessWorkspace\(membership,\["owner","admin"\]\)/);
 assert.match(source,/FROM audit_logs WHERE workspace_id=\$1/);
});
