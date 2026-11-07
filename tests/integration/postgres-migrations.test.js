import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {applyMigrations} from "../../scripts/migrate.js";

test("PostgreSQL migrations are executable, repeatable and enforce tenant relations",{
 skip:!process.env.TEST_DATABASE_URL
},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 let workspaceA,workspaceB,userId;
 try{
  const first=await applyMigrations(pool);
  assert.equal(first.discovered,9);
  const second=await applyMigrations(pool);
  assert.deepEqual(second.versions,first.versions);
  const tables=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()");
  const names=new Set(tables.rows.map(row=>row.tablename));
  for(const name of ["workspaces","users","workspace_members","researches","competitors","market_products","price_observations","market_observations","market_reports","audit_logs","workspace_invitations","schema_migrations"])assert.ok(names.has(name),`missing table ${name}`);
  const a=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Integration A',$1) RETURNING id",[`integration-a-${Date.now()}`]);
  workspaceA=a.rows[0].id;
  const b=await pool.query("INSERT INTO workspaces(name,slug) VALUES('Integration B',$1) RETURNING id",[`integration-b-${Date.now()}`]);
  workspaceB=b.rows[0].id;
  const user=await pool.query("INSERT INTO users(auth_subject,email,display_name) VALUES($1,$2,'CI integration') RETURNING id",[`ci-${Date.now()}`,`ci-${Date.now()}@example.test`]);
  userId=user.rows[0].id;
  const research=await pool.query("INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Research','Ecuador','Retail','Test') RETURNING id",[workspaceA,userId]);
  const competitor=await pool.query("INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Competitor A') RETURNING id",[workspaceA,userId]);
  await assert.rejects(()=>pool.query("INSERT INTO market_products(workspace_id,competitor_id,name) VALUES($1,$2,'Cross tenant product')",[workspaceB,competitor.rows[0].id]),/foreign key/i);
  const product=await pool.query("INSERT INTO market_products(workspace_id,competitor_id,research_id,created_by,name) VALUES($1,$2,$3,$4,'Product A') RETURNING id",[workspaceA,competitor.rows[0].id,research.rows[0].id,userId]);
  await pool.query("INSERT INTO price_observations(workspace_id,product_id,recorded_by,price,currency,observed_on) VALUES($1,$2,$3,12.50,'USD','2026-11-07')",[workspaceA,product.rows[0].id,userId]);
  const history=await pool.query("SELECT count(*)::int AS count FROM price_observations WHERE workspace_id=$1 AND product_id=$2",[workspaceA,product.rows[0].id]);
  assert.equal(history.rows[0].count,1);
  const snapshot=await pool.query("INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by) VALUES($1,$2,1,$3::jsonb,$4) RETURNING id,report_hash",[workspaceA,research.rows[0].id,JSON.stringify({title:"Snapshot de integración"}),userId]);
  assert.match(snapshot.rows[0].report_hash,/^[0-9a-f]{64}$/);
  const integrity=await pool.query("SELECT encode(digest(report_data::text,'sha256'),'hex')=report_hash AS verified FROM market_reports WHERE id=$1",[snapshot.rows[0].id]);
  assert.equal(integrity.rows[0].verified,true);
  await assert.rejects(()=>pool.query("UPDATE market_reports SET report_data='{}'::jsonb WHERE id=$1",[snapshot.rows[0].id]),/immutable/i);
  const membership=await pool.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceA,userId]);
  assert.equal(membership.rowCount,1);
 }finally{
  if(workspaceA)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceA]);
  if(workspaceB)await pool.query("DELETE FROM workspaces WHERE id=$1",[workspaceB]);
  if(userId)await pool.query("DELETE FROM users WHERE id=$1",[userId]);
  await pool.end();
 }
});
