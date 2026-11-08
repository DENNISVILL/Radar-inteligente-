import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("report snapshot migration blocks direct DELETE while preserving parent cascades", async () => {
 const sql = await readFile(new URL("../../../database/migrations/011_market_report_delete_immutability.sql", import.meta.url), "utf8");
 assert.match(sql, /BEFORE DELETE ON market_reports/i);
 assert.match(sql, /pg_trigger_depth\(\)\s*>\s*1/i);
 assert.match(sql, /RETURN OLD/i);
 assert.match(sql, /Market report snapshots are immutable/i);
});
