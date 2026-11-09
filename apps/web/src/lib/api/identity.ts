const API_URL = process.env.NEXT_PUBLIC_RADAR_API_URL ?? "http://localhost:3000";

export type CurrentIdentity = { subject: string; email: string | null };

export async function getCurrentIdentity(accessToken: string): Promise<CurrentIdentity> {
  const response = await fetch(new URL("/api/v1/me", API_URL), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const message = response.status === 503
      ? "La autenticación de la API todavía no está configurada."
      : response.status === 401
        ? "La sesión no fue aceptada por la API. Verifica que el proveedor de identidad coincida."
        : "No fue posible validar la sesión con Radar Comercial.";
    throw new Error(message);
  }
  return response.json() as Promise<CurrentIdentity>;
}
