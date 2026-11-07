const allowedStatuses = new Set(["draft", "in_progress", "completed", "archived"]);

const requiredText = (value, field, maxLength = 160) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} es obligatorio.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new RangeError(`${field} supera el máximo de ${maxLength} caracteres.`);
  }
  return normalized;
};

/**
 * Creates a normalized research record.
 * Persistence, authentication and external data collection are intentionally
 * outside this domain function.
 */
export function createResearch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("La investigación debe ser un objeto válido.");
  }

  const title = requiredText(input.title, "El título", 120);
  const country = requiredText(input.country, "El país", 80);
  const sector = requiredText(input.sector, "El sector", 100);
  const objective = requiredText(input.objective, "El objetivo", 1000);

  const city = input.city == null || input.city === ""
    ? null
    : requiredText(input.city, "La ciudad", 100);

  const status = input.status ?? "draft";
  if (!allowedStatuses.has(status)) {
    throw new RangeError("El estado de la investigación no es válido.");
  }

  return Object.freeze({
    id: input.id ?? null,
    title,
    country,
    city,
    sector,
    objective,
    status,
    createdAt: input.createdAt ?? null
  });
}

export function isResearchStatus(value) {
  return allowedStatuses.has(value);
}