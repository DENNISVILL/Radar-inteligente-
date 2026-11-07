import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("workspace invitations store only token hashes and enforce one pending invite per workspace and email",async()=>{
 const sql=await readFile(new URL("../../../database/migrations/009_workspace_invitations.sql",import.meta.url),"utf8");
 assert.match(sql,/token_hash CHAR\(64\) NOT NULL UNIQUE/i);
 assert.match(sql,/UNIQUE INDEX[\s\S]*workspace_id,lower\(email\)/i);
 assert.match(sql,/accepted_at IS NULL AND revoked_at IS NULL/i);
 assert.match(sql,/expires_at TIMESTAMPTZ NOT NULL/i);
 assert.match(sql,/role IN \('admin','analyst','viewer'\)/i);
});
