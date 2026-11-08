import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Fastify from "fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { identityRoutes } from "../../../src/modules/identity/presentation/identity.routes.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";

test("Supabase JWT verification protects identity and workspace-access HTTP routes", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const { privateKey: wrongPrivateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const keyId = "radar-http-test-key";
  const server = createServer((request, response) => {
    if (request.url !== "/auth/v1/.well-known/jwks.json") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ keys: [{ ...jwk, kid: keyId, alg: "RS256", use: "sig" }] }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const supabaseUrl = `http://127.0.0.1:${address.port}`;
  const calls = [];
  const database = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("FROM workspace_members wm")) {
        return { rows: values[1] === workspaceId ? [{ workspace_id: workspaceId, workspace_name: "Workspace de prueba", role: "viewer" }] : [] };
      }
      return { rows: [] };
    },
    async connect() {
      throw new Error("No se esperaba abrir una transacción en estas rutas.");
    }
  };
  const app = Fastify({ logger: false });
  try {
    await app.register(identityRoutes, { database, config: { supabaseUrl } });
    await app.ready();

    async function token({
      signingKey = privateKey,
      kid = keyId,
      issuer = `${supabaseUrl}/auth/v1`,
      audience = "authenticated",
      subject = "auth-user",
      expiration = "5m"
    } = {}) {
      const jwt = new SignJWT({ email: "user@example.test", role: "authenticated" })
        .setProtectedHeader({ alg: "RS256", kid })
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expiration);
      if (typeof subject === "string") jwt.setSubject(subject);
      return jwt.sign(signingKey);
    }

    const validToken = await token();
    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: `Bearer ${validToken}` } });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(me.json(), { subject: "auth-user", email: "user@example.test" });

    const access = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/access`,
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(access.statusCode, 200);
    assert.deepEqual(access.json(), { workspaceId, workspaceName: "Workspace de prueba", role: "viewer" });
    const foreignAccess = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/33333333-3333-4333-8333-333333333333/access",
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(foreignAccess.statusCode, 403);
    assert.equal(foreignAccess.json().error, "FORBIDDEN");

    const malformedAccess = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/not-a-uuid/access",
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(malformedAccess.statusCode, 400);
    assert.equal(malformedAccess.json().error, "INVALID_WORKSPACE_ID");
    assert.equal(calls.length, 2);

    const invalidTokens = [
      await token({ expiration: Math.floor(Date.now() / 1000) - 60 }),
      await token({ audience: "wrong-audience" }),
      await token({ issuer: "https://wrong-issuer.example.test/auth/v1" }),
      await token({ subject: null }),
      await token({ signingKey: wrongPrivateKey })
    ];
    for (const invalidToken of invalidTokens) {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: { authorization: `Bearer ${invalidToken}` }
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error, "INVALID_TOKEN");
    }
    assert.equal(calls.length, 2, "invalid tokens must not reach workspace data queries");
  } finally {
    await app.close();
    await new Promise(resolve => server.close(resolve));
  }
});
