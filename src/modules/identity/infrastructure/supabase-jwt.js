import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksCache = new Map();

function getJwks(supabaseUrl) {
  if (!jwksCache.has(supabaseUrl)) {
    const url = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    jwksCache.set(supabaseUrl, createRemoteJWKSet(url));
  }
  return jwksCache.get(supabaseUrl);
}

export async function verifySupabaseAccessToken(token, supabaseUrl) {
  if (!supabaseUrl) {
    const error = new Error("La autenticación todavía no está configurada.");
    error.statusCode = 503;
    throw error;
  }
  const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: "authenticated",
    algorithms: ["ES256", "RS256"]
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    const error = new Error("El token no contiene un identificador de usuario válido.");
    error.statusCode = 401;
    throw error;
  }
  return Object.freeze({
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : null
  });
}

export function readBearerToken(header) {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}
