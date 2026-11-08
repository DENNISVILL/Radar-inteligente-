import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksCache = new Map();

function getJwks(supabaseUrl) {
  if (!jwksCache.has(supabaseUrl)) {
    const url = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    jwksCache.set(supabaseUrl, createRemoteJWKSet(url));
  }
  return jwksCache.get(supabaseUrl);
}

export async function verifySupabaseAccessToken(token, supabaseUrl, { maxTokenAgeSeconds = 3600 } = {}) {
  if (!supabaseUrl) {
    const error = new Error("La autenticación todavía no está configurada.");
    error.statusCode = 503;
    throw error;
  }
  const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: "authenticated",
    algorithms: ["ES256", "RS256"],
    requiredClaims: ["sub", "iat", "exp", "session_id"],
    maxTokenAge: maxTokenAgeSeconds,
    clockTolerance: 5
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


export async function verifySupabaseSession(identity, token, { supabaseUrl, apiKey, timeoutMs = 5000 }) {
  if (!apiKey) return identity;
  let response;
  try {
    response = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      method: "GET",
      headers: { apikey: apiKey, authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (cause) {
    const error = new Error("No se pudo comprobar el estado actual de la sesión con Supabase.");
    error.statusCode = 503;
    error.code = "AUTH_PROVIDER_UNAVAILABLE";
    error.cause = cause;
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error("La sesión ya no está activa en el proveedor de identidad.");
    error.statusCode = 401;
    error.code = "SUPABASE_SESSION_INVALID";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("El proveedor de identidad no pudo comprobar la sesión.");
    error.statusCode = 503;
    error.code = "AUTH_PROVIDER_UNAVAILABLE";
    throw error;
  }
  let user;
  try {
    user = await response.json();
  } catch (cause) {
    const error = new Error("El proveedor de identidad devolvió una respuesta inválida.");
    error.statusCode = 503;
    error.code = "AUTH_PROVIDER_UNAVAILABLE";
    error.cause = cause;
    throw error;
  }
  if (!user || user.id !== identity.subject) {
    const error = new Error("La sesión no corresponde al usuario autenticado.");
    error.statusCode = 401;
    error.code = "SUPABASE_SESSION_INVALID";
    throw error;
  }
  return Object.freeze({
    ...identity,
    email: typeof user.email === "string" ? user.email : identity.email,
    emailConfirmedAt: typeof user.email_confirmed_at === "string" ? user.email_confirmed_at : null
  });
}
