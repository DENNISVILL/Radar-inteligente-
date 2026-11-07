import { readBearerToken, verifySupabaseAccessToken } from "../infrastructure/supabase-jwt.js";
import { canAccessWorkspace, findWorkspaceAccess } from "../application/workspace-access.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireIdentity(request, reply, options) {
  const token = readBearerToken(request.headers.authorization);
  if (!token) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Se requiere un token Bearer válido." });
  try {
    request.identity = await verifySupabaseAccessToken(token, options.config.supabaseUrl);
  } catch (error) {
    const status = error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_CLAIM_VALIDATION_FAILED" ? 401 : (error.statusCode ?? 401);
    return reply.code(status).send({ error: status === 503 ? "AUTH_NOT_CONFIGURED" : "INVALID_TOKEN", message: status === 503 ? error.message : "El token no es válido o ha expirado." });
  }
}

export async function identityRoutes(app, options) {
  app.get("/api/v1/me", { preHandler: (request, reply) => requireIdentity(request, reply, options) }, async request => ({
    subject: request.identity.subject,
    email: request.identity.email
  }));

  app.get("/api/v1/workspaces/:workspaceId/access", {
    preHandler: (request, reply) => requireIdentity(request, reply, options)
  }, async (request, reply) => {
    if (!uuidPattern.test(request.params.workspaceId)) {
      return reply.code(400).send({ error: "INVALID_WORKSPACE_ID", message: "El identificador del espacio de trabajo no es válido." });
    }
    const membership = await findWorkspaceAccess(options.database, request.identity.subject, request.params.workspaceId);
    if (!canAccessWorkspace(membership)) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "No tienes acceso a este espacio de trabajo." });
    }
    return { workspaceId: membership.workspace_id, workspaceName: membership.workspace_name, role: membership.role };
  });
}
