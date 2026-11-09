const roles = new Set(["owner", "admin", "analyst", "viewer"]);
export function canAccessWorkspace(membership, allowedRoles = []) {
  if (!membership || !roles.has(membership.role)) return false;
  return allowedRoles.length === 0 || allowedRoles.includes(membership.role);
}
export async function findWorkspaceAccess(database, authSubject, workspaceId) {
  const result = await database.query(
    `SELECT w.id AS workspace_id, w.name AS workspace_name, wm.role
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE u.auth_subject = $1 AND u.status = 'active'
       AND w.id = $2 AND w.status = 'active'
     LIMIT 1`,
    [authSubject, workspaceId]
  );
  return result.rows[0] ?? null;
}
