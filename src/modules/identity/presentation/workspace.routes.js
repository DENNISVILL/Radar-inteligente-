import { ensureIdentityUser } from "../application/identity-user.js";
import { createWorkspace, listUserWorkspaces } from "../application/workspaces.js";

export async function workspaceRoutes(app, options) {
  app.get("/api/v1/workspaces", {
    preHandler: (request, reply) => options.requireIdentity(request, reply)
  }, async request => {
    const user = await ensureIdentityUser(options.database, request.identity);
    const workspaces = await listUserWorkspaces(options.database, user.id);
    return { data: workspaces };
  });

  app.post("/api/v1/workspaces", {
    preHandler: (request, reply) => options.requireIdentity(request, reply)
  }, async (request, reply) => {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "INVALID_WORKSPACE_NAME", message: "El nombre debe tener entre 1 y 120 caracteres." });
    }
    const user = await ensureIdentityUser(options.database, request.identity);
    const workspace = await createWorkspace(options.database, user.id, name);
    return reply.code(201).send({ data: workspace });
  });
}
