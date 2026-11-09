import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { applyMigrations } from "../../scripts/migrate.js";

test("PostgreSQL protects report snapshots from direct deletion but permits parent cascades", {
 skip: !process.env.TEST_DATABASE_URL
}, async () => {
 const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
 const suffix = randomUUID();
 let workspaceId, userId, researchId, reportId;
 try {
  await applyMigrations(pool);
  const workspace = await pool.query(
   "INSERT INTO workspaces(name,slug) VALUES('Report immutability',$1) RETURNING id",
   ["report-immutability-" + suffix]
  );
  workspaceId = workspace.rows[0].id;
  const user = await pool.query(
   "INSERT INTO users(auth_subject,email) VALUES($1,$2) RETURNING id",
   ["report-immutability-" + suffix, "report-immutability-" + suffix + "@example.test"]
  );
  userId = user.rows[0].id;
  const research = await pool.query(
   "INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Report test','Ecuador','Retail','Delete guard') RETURNING id",
   [workspaceId, userId]
  );
  researchId = research.rows[0].id;
  const report = await pool.query(
   "INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by) VALUES($1,$2,1,$3::jsonb,$4) RETURNING id",
   [workspaceId, researchId, JSON.stringify({ title: "Immutable" }), userId]
  );
  reportId = report.rows[0].id;

  await assert.rejects(
   () => pool.query("DELETE FROM market_reports WHERE id=$1", [reportId]),
   error => error.code === "55000" && /immutable.*DELETE/i.test(error.message)
  );
  const retained = await pool.query("SELECT id FROM market_reports WHERE id=$1", [reportId]);
  assert.equal(retained.rowCount, 1);

  // A parent lifecycle deletion is still allowed to cascade to its snapshots.
  await pool.query("DELETE FROM researches WHERE id=$1 AND workspace_id=$2", [researchId, workspaceId]);
  researchId = null;
  const cascaded = await pool.query("SELECT id FROM market_reports WHERE id=$1", [reportId]);
  assert.equal(cascaded.rowCount, 0);
  reportId = null;
 } finally {
  if (workspaceId) await pool.query("DELETE FROM workspaces WHERE id=$1", [workspaceId]).catch(() => {});
  if (userId) await pool.query("DELETE FROM users WHERE id=$1", [userId]).catch(() => {});
  await pool.end();
 }
});
