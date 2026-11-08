import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import pg from "pg";
import { applyMigrations } from "../../scripts/migrate.js";
import { workspaceMemberRoutes } from "../../src/modules/identity/presentation/workspace-member.routes.js";
import { workspaceInvitationRoutes } from "../../src/modules/identity/presentation/workspace-invitation.routes.js";
import { researchRoutes } from "../../src/modules/research/presentation/research.routes.js";
import { marketIntelligenceRoutes } from "../../src/modules/market-intelligence/presentation/market-intelligence.routes.js";
import { marketReportRoutes } from "../../src/modules/market-intelligence/presentation/market-report.routes.js";

test("PostgreSQL-backed HTTP authorization enforces roles and workspace isolation", {
  skip: !process.env.TEST_DATABASE_URL
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const suffix = randomUUID();
  const workspaceSlugA = `http-auth-a-${suffix}`;
  const workspaceSlugB = `http-auth-b-${suffix}`;
  const identities = ["owner", "admin", "analyst", "viewer", "outsider"].map(role => ({
    role,
    subject: `http-auth-${role}-${suffix}`,
    email: `http-auth-${role}-${suffix}@example.test`
  }));
  let workspaceA;
  let workspaceB;
  let app;

  try {
    await applyMigrations(pool);

    const createdA = await pool.query(
      "INSERT INTO workspaces(name,slug) VALUES('HTTP authorization A',$1) RETURNING id",
      [workspaceSlugA]
    );
    workspaceA = createdA.rows[0].id;
    const createdB = await pool.query(
      "INSERT INTO workspaces(name,slug) VALUES('HTTP authorization B',$1) RETURNING id",
      [workspaceSlugB]
    );
    workspaceB = createdB.rows[0].id;

    for (const identity of identities) {
      await pool.query(
        "INSERT INTO users(auth_subject,email) VALUES($1,$2)",
        [identity.subject, identity.email]
      );
    }

    const userIds = await pool.query(
      "SELECT id,auth_subject FROM users WHERE auth_subject = ANY($1::text[])",
      [identities.map(identity => identity.subject)]
    );
    const idsBySubject = new Map(userIds.rows.map(row => [row.auth_subject, row.id]));
    for (const identity of identities.slice(0, 4)) {
      await pool.query(
        "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,$3)",
        [workspaceA, idsBySubject.get(identity.subject), identity.role]
      );
    }
    await pool.query(
      "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
      [workspaceB, idsBySubject.get(identities[4].subject)]
    );

    const researchAResult = await pool.query(
      "INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Research A','Ecuador','Retail','Authorization integration') RETURNING id",
      [workspaceA, idsBySubject.get(identities[0].subject)]
    );
    const researchA = researchAResult.rows[0].id;
    const researchBResult = await pool.query(
      "INSERT INTO researches(workspace_id,created_by,title,country,sector,objective) VALUES($1,$2,'Research B','Ecuador','Retail','Tenant isolation integration') RETURNING id",
      [workspaceB, idsBySubject.get(identities[4].subject)]
    );
    const researchB = researchBResult.rows[0].id;

    const competitorAResult = await pool.query(
      "INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Competitor A') RETURNING id",
      [workspaceA, idsBySubject.get(identities[0].subject)]
    );
    const competitorA = competitorAResult.rows[0].id;
    const competitorBResult = await pool.query(
      "INSERT INTO competitors(workspace_id,created_by,name) VALUES($1,$2,'Competitor B') RETURNING id",
      [workspaceB, idsBySubject.get(identities[4].subject)]
    );
    const competitorB = competitorBResult.rows[0].id;

    const productAResult = await pool.query(
      "INSERT INTO market_products(workspace_id,competitor_id,research_id,created_by,name) VALUES($1,$2,$3,$4,'Product A') RETURNING id",
      [workspaceA, competitorA, researchA, idsBySubject.get(identities[0].subject)]
    );
    const productA = productAResult.rows[0].id;
    const productBResult = await pool.query(
      "INSERT INTO market_products(workspace_id,competitor_id,research_id,created_by,name) VALUES($1,$2,$3,$4,'Product B') RETURNING id",
      [workspaceB, competitorB, researchB, idsBySubject.get(identities[4].subject)]
    );
    const productB = productBResult.rows[0].id;

    const snapshot = await pool.query(
      "INSERT INTO market_reports(workspace_id,research_id,version,report_data,generated_by) VALUES($1,$2,1,$3::jsonb,$4) RETURNING id",
      [workspaceA, researchA, JSON.stringify({ title: "Integration snapshot" }), idsBySubject.get(identities[0].subject)]
    );
    const reportA = snapshot.rows[0].id;

    const emailBySubject = new Map(identities.map(identity => [identity.subject, identity.email]));
    const requireIdentity = async request => {
      const subject = request.headers["x-test-subject"];
      request.identity = { subject, email: emailBySubject.get(subject) ?? null };
    };
    app = Fastify({ logger: false });
    const options = { database: pool, requireIdentity };
    await app.register(workspaceMemberRoutes, options);
    await app.register(workspaceInvitationRoutes, options);
    await app.register(researchRoutes, options);
    await app.register(marketIntelligenceRoutes, options);
    await app.register(marketReportRoutes, options);
    await app.ready();

    const request = (subject, method, url, payload) => app.inject({
      method,
      url,
      headers: { "x-test-subject": subject },
      ...(payload === undefined ? {} : { payload })
    });
    const researchPayload = {
      title: "New research",
      country: "Ecuador",
      sector: "Retail",
      objective: "Verify the HTTP role policy"
    };

    for (const identity of identities.slice(0, 4)) {
      const headers = identity.subject;
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/researches`)).statusCode, 200, identity.role);
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/competitors`)).statusCode, 200, identity.role);
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/products`)).statusCode, 200, identity.role);
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/researches/${researchA}/report`)).statusCode, 200, identity.role);
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/researches/${researchA}/reports`)).statusCode, 200, identity.role);
      assert.equal((await request(headers, "GET", `/api/v1/workspaces/${workspaceA}/researches/${researchA}/reports/${reportA}`)).statusCode, 200, identity.role);

      const canManage = identity.role === "owner" || identity.role === "admin";
      for (const url of [
        `/api/v1/workspaces/${workspaceA}/members`,
        `/api/v1/workspaces/${workspaceA}/invitations`,
        `/api/v1/workspaces/${workspaceA}/audit-logs`
      ]) {
        assert.equal((await request(headers, "GET", url)).statusCode, canManage ? 200 : 403, identity.role + " " + url);
      }

      const createdResearch = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/researches`, researchPayload);
      const createdCompetitor = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/competitors`, { name: `Competitor ${identity.role}` });
      const createdProduct = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/products`, { name: `Product ${identity.role}`, competitorId: competitorA, researchId: researchA });
      const createdPrice = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/products/${productA}/prices`, { price: 10, currency: "USD", observedOn: "2026-11-07" });
      const createdObservation = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/researches/${researchA}/observations`, {
        competitorId: competitorA,
        type: "risk",
        title: `Risk ${identity.role}`,
        content: "Integration test observation",
        observedOn: "2026-11-07"
      });
      const createdSnapshot = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/researches/${researchA}/reports`);

      if (identity.role === "viewer") {
        for (const response of [createdResearch, createdCompetitor, createdProduct, createdPrice, createdObservation, createdSnapshot]) {
          assert.equal(response.statusCode, 403, identity.role + " must not mutate workspace data");
          assert.equal(response.json().error, "FORBIDDEN");
        }
      } else {
        for (const response of [createdResearch, createdCompetitor, createdProduct, createdPrice, createdObservation, createdSnapshot]) {
          assert.ok([201].includes(response.statusCode), identity.role + " must be allowed to write: " + response.body);
        }
      }

      const invitation = await request(headers, "POST", `/api/v1/workspaces/${workspaceA}/invitations`, {
        email: `invite-${identity.role}-${suffix}@example.test`,
        role: "analyst"
      });
      if (canManage) {
        assert.equal(invitation.statusCode, 201, identity.role + " can create invitations");
      } else {
        assert.equal(invitation.statusCode, 403, identity.role + " cannot create invitations");
        assert.equal(invitation.json().error, "FORBIDDEN");
      }
    }

    const ownerSubject = identities[0].subject;
    assert.equal((await request(ownerSubject, "GET", `/api/v1/workspaces/${workspaceB}/researches`)).statusCode, 403);
    assert.equal((await request(ownerSubject, "POST", `/api/v1/workspaces/${workspaceB}/competitors`, { name: "Cross-workspace write" })).statusCode, 403);

    const foreignResearch = await request(ownerSubject, "GET", `/api/v1/workspaces/${workspaceA}/researches/${researchB}`);
    assert.equal(foreignResearch.statusCode, 404);
    assert.equal(foreignResearch.json().error, "RESEARCH_NOT_FOUND");

    const foreignPrices = await request(ownerSubject, "GET", `/api/v1/workspaces/${workspaceA}/products/${productB}/prices`);
    assert.equal(foreignPrices.statusCode, 200);
    assert.deepEqual(foreignPrices.json().data, []);

    const outsiderSubject = identities[4].subject;
    assert.equal((await request(outsiderSubject, "GET", `/api/v1/workspaces/${workspaceA}/researches`)).statusCode, 403);
    assert.equal((await request(outsiderSubject, "POST", `/api/v1/workspaces/${workspaceA}/competitors`, { name: "Non-member write" })).statusCode, 403);
  } finally {
    if (app) await app.close();
    if (workspaceA) await pool.query("DELETE FROM workspaces WHERE id=$1", [workspaceA]);
    if (workspaceB) await pool.query("DELETE FROM workspaces WHERE id=$1", [workspaceB]);
    await pool.query("DELETE FROM users WHERE auth_subject = ANY($1::text[])", [identities.map(identity => identity.subject)]).catch(() => {});
    await pool.end();
  }
});
