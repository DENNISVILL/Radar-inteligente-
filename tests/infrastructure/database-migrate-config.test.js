import test from "node:test";
import assert from "node:assert/strict";
import { resolveMigrationDatabaseUrl } from "../../scripts/migrate.js";

test("production migrations require a dedicated migration connection",()=>{
 assert.throws(()=>resolveMigrationDatabaseUrl({nodeEnv:"production",databaseUrl:"postgres://runtime",migrationDatabaseUrl:""}),/MIGRATION_DATABASE_URL/);
});

test("production migrations use the dedicated migration connection",()=>{
 assert.equal(resolveMigrationDatabaseUrl({nodeEnv:"production",databaseUrl:"postgres://runtime",migrationDatabaseUrl:"postgres://migrator"}),"postgres://migrator");
});

test("development may fall back to DATABASE_URL for local convenience",()=>{
 assert.equal(resolveMigrationDatabaseUrl({nodeEnv:"development",databaseUrl:"postgres://local",migrationDatabaseUrl:""}),"postgres://local");
});

test("an explicit migration connection takes precedence in every environment",()=>{
 assert.equal(resolveMigrationDatabaseUrl({nodeEnv:"test",databaseUrl:"postgres://runtime",migrationDatabaseUrl:"postgres://migrator"}),"postgres://migrator");
});
