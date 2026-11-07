import { randomUUID } from "node:crypto";

const slugify = value => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

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
    await client.query("COMMIT");
    return { ...workspace, role: "owner" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
