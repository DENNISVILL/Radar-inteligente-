import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {applyMigrations} from "../../scripts/migrate.js";

test("applies every numbered migration in order and skips applied versions",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"radar-migrations-"));
 try{
  await writeFile(join(dir,"002_second.sql"),"SELECT 2;");
  await writeFile(join(dir,"001_first.sql"),"SELECT 1;");
  await writeFile(join(dir,"README.md"),"not a migration");
  const applied=new Set(),statements=[];
  const client={async query(sql,values=[]){
   statements.push(sql);
   if(sql.startsWith("SELECT version"))return {rowCount:applied.has(values[0])?1:0,rows:[]};
   if(sql.startsWith("INSERT INTO schema_migrations"))applied.add(values[0]);
   return {rowCount:0,rows:[]};
  },release(){statements.push("RELEASE");}};
  const pool={async connect(){return client;}};
  const first=await applyMigrations(pool,new URL("file://"+dir+"/"));
  assert.deepEqual(first.versions,["001_first","002_second"]);
  assert.deepEqual([...applied],["001_first","002_second"]);
  assert.ok(statements.indexOf("SELECT 1;")<statements.indexOf("SELECT 2;"));
  const second=await applyMigrations(pool,new URL("file://"+dir+"/"));
  assert.equal(second.discovered,2);
  assert.equal(statements.filter(x=>x==="SELECT 1;").length,1);
  assert.equal(statements.filter(x=>x==="SELECT 2;").length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("rolls back a failed migration and releases its client",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"radar-migrations-fail-"));
 try{
  await writeFile(join(dir,"001_broken.sql"),"BROKEN SQL;");
  const statements=[];
  const client={async query(sql){statements.push(sql);if(sql==="BROKEN SQL;")throw new Error("migration failed");return {rowCount:0,rows:[]};},release(){statements.push("RELEASE");}};
  await assert.rejects(()=>applyMigrations({async connect(){return client;}},new URL("file://"+dir+"/")),/migration failed/);
  assert.ok(statements.includes("ROLLBACK"));
  assert.equal(statements.at(-1),"RELEASE");
 }finally{await rm(dir,{recursive:true,force:true});}
});
