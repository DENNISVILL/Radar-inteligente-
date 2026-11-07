export async function ensureIdentityUser(database, identity) {
  const result = await database.query(
    `INSERT INTO users (auth_subject, email)
     VALUES ($1, $2)
     ON CONFLICT (auth_subject) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, users.email),
           updated_at = NOW()
     RETURNING id, email, display_name, status`,
    [identity.subject, identity.email ?? null]
  );
  const user = result.rows[0];
  if (!user || user.status !== "active") {
    const error = new Error("La cuenta no está habilitada para utilizar Radar Comercial.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}
