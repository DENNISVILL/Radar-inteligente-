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
      expiration = "5m",
      issuedAt = Math.floor(Date.now() / 1000),
      includeIssuedAt = true,
      includeExpiration = true,
      sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    } = {}) {
      const jwt = new SignJWT({ email: "user@example.test", role: "authenticated", session_id: sessionId })
        .setProtectedHeader({ alg: "RS256", kid })
        .setIssuer(issuer)
        .setAudience(audience);
      if (includeIssuedAt) jwt.setIssuedAt(issuedAt);
      if (includeExpiration) jwt.setExpirationTime(expiration);
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
    assert.equal(calls.length, 3);

    const invalidTokens = [
      await token({ expiration: Math.floor(Date.now() / 1000) - 60 }),
      await token({ audience: "wrong-audience" }),
      await token({ issuer: "https://wrong-issuer.example.test/auth/v1" }),
      await token({ subject: null }),
      await token({ signingKey: wrongPrivateKey }),
      await token({ includeIssuedAt: false }),
      await token({ includeExpiration: false }),
      await token({ issuedAt: Math.floor(Date.now() / 1000) - 7200 }),
      await token({ sessionId: "not-a-session-uuid" })
    ];
    for (const [index, invalidToken] of invalidTokens.entries()) {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: { authorization: `Bearer ${invalidToken}` }
      });
      assert.equal(response.statusCode, 401, "invalid token fixture index " + index);
      assert.equal(response.json().error, "INVALID_TOKEN");
    }
    assert.equal(calls.length, 3, "invalid tokens must not reach workspace data queries");
  } finally {
    await app.close();
    await new Promise(resolve => server.close(resolve));
  }
});


test("JWKS provider outages return 503 instead of misclassifying valid sessions as invalid tokens", async () => {
  const { privateKey } = await generateKeyPair("RS256");
  const server = createServer((_request, response) => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: "temporarily unavailable" }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const supabaseUrl = `http://127.0.0.1:${address.port}`;
  const database = {
    async query() {
      throw new Error("No debe consultar la base de datos si falla el proveedor JWKS.");
    }
  };
  const app = Fastify({ logger: false });
  try {
    await app.register(identityRoutes, { database, config: { supabaseUrl } });
    await app.ready();
    const jwt = await new SignJWT({ email: "user@example.test", role: "authenticated", session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
      .setProtectedHeader({ alg: "RS256", kid: "provider-outage-key" })
      .setIssuer(`${supabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setSubject("auth-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${jwt}` }
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error, "AUTH_PROVIDER_UNAVAILABLE");
  } finally {
    await app.close();
    await new Promise(resolve => server.close(resolve));
  }
});


test("live Supabase session introspection detects revoked sessions and requires confirmed email for invitations", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const keyId = "radar-session-lifecycle-key";
  let userStatus = 200;
  let emailConfirmedAt = null;
  let disabledLocalAccount = false;
  const seenHeaders = [];
  const server = createServer((request, response) => {
    if (request.url === "/auth/v1/.well-known/jwks.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ keys: [{ ...jwk, kid: keyId, alg: "RS256", use: "sig" }] }));
      return;
    }
    if (request.url === "/auth/v1/user") {
      seenHeaders.push({ apikey: request.headers.apikey, authorization: request.headers.authorization });
      if (userStatus !== 200) {
        response.writeHead(userStatus, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "auth response" }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        id: "auth-user-session",
        email: "confirmed@example.test",
        email_confirmed_at: emailConfirmedAt
      }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const supabaseUrl = `http://127.0.0.1:${address.port}`;
  const database = {
    async query(sql) {
      if (sql.includes("FROM users WHERE auth_subject")) {
        return { rows: disabledLocalAccount ? [{ status: "disabled" }] : [{ status: "active" }] };
      }
      return { rows: [] };
    },
    async connect() {
      throw new Error("No debe abrirse una transacción en la prueba de sesión.");
    }
  };
  const app = Fastify({ logger: false });
  try {
    await app.register(identityRoutes, {
      database,
      config: {
        supabaseUrl,
        supabaseApiKey: "sb_publishable_test",
        supabaseJwtMaxAgeSeconds: 3600
      }
    });
    await app.ready();
    const jwt = await new SignJWT({
      email: "untrusted-claim@example.test",
      role: "authenticated",
      session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    })
      .setProtectedHeader({ alg: "RS256", kid: keyId })
      .setIssuer(`${supabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setSubject("auth-user-session")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const headers = { authorization: `Bearer ${jwt}` };

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().email, "confirmed@example.test");
    assert.equal(seenHeaders[0].apikey, "sb_publishable_test");
    assert.equal(seenHeaders[0].authorization, `Bearer ${jwt}`);

    const invitation = await app.inject({
      method: "POST",
      url: "/api/v1/invitations/accept",
      headers,
      payload: { token: "a".repeat(48) }
    });
    assert.equal(invitation.statusCode, 403);
    assert.equal(invitation.json().error, "EMAIL_NOT_CONFIRMED");

    emailConfirmedAt = new Date().toISOString();
    const confirmedInvitation = await app.inject({
      method: "POST",
      url: "/api/v1/invitations/accept",
      headers,
      payload: { token: "a".repeat(48) }
    });
    assert.equal(confirmedInvitation.statusCode, 400);
    assert.equal(confirmedInvitation.json().error, "INVALID_INVITATION");

    disabledLocalAccount = true;
    const disabled = await app.inject({ method: "GET", url: "/api/v1/me", headers });
    assert.equal(disabled.statusCode, 403);
    assert.equal(disabled.json().error, "ACCOUNT_DISABLED");

    disabledLocalAccount = false;
    userStatus = 401;
    const revoked = await app.inject({ method: "GET", url: "/api/v1/me", headers });
    assert.equal(revoked.statusCode, 401);
    assert.equal(revoked.json().error, "INVALID_TOKEN");

    userStatus = 503;
    const unavailable = await app.inject({ method: "GET", url: "/api/v1/me", headers });
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json().error, "AUTH_PROVIDER_UNAVAILABLE");
  } finally {
    await app.close();
    await new Promise(resolve => server.close(resolve));
  }
});
