import { randomUUID } from "node:crypto";

const slugify = value => value.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

export async function listUserWorkspaces(database, userId) {
  const result = await database.query(
    `SELECT w.id, w.name, w.slug, wm.role, w.created_at
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1 AND w.status = 'active'
     ORDER BY w.created_at ASC`,
    [userId]
  );
  return result.rows;
}

export async function createWorkspace(database, userId, name) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const suffix = randomUUID().slice(0, 8);
    const base = slugify(name) || "workspace";
    const slug = `${base}-${suffix}`;
    const created = await client.query(
      "INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at",
      [name, slug]
    );
    const workspace = created.rows[0];
    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
      [workspace.id, userId]
    );
    // Workspace creation and its initial owner membership must be auditable
    // in the same transaction; actor identity comes from the verified session.
    await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
      VALUES($1,$2,'workspace.created','workspace',$3,'{"initialOwnerRole":"owner"}'::jsonb)`,
      [workspace.id, userId, workspace.id]
    );
    await client.query(`INSERT INTO audit_logs(workspace_id,actor_user_id,event_type,resource_type,resource_id,metadata)
      VALUES($1,$2,'workspace_member.added','workspace_member',$3,'{"role":"owner","reason":"workspace_creation"}'::jsonb)`,
      [workspace.id, userId, userId]
    );
    await client.query("COMMIT");
    return { ...workspace, role: "owner" };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    client.release();
  }
}
