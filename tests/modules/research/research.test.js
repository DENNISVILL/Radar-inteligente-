import test from "node:test";
import assert from "node:assert/strict";
import { createResearch, isResearchStatus } from "../../../src/modules/research/domain/research.js";

const validInput = {
  title: "Análisis de cafeterías",
  country: "Ecuador",
  city: "Loja",
  sector: "Alimentos y bebidas",
  objective: "Identificar competidores y rangos de precios publicados."
};

test("creates a normalized draft research", () => {
  const research = createResearch({ ...validInput, title: "  Análisis de cafeterías  " });
  assert.equal(research.title, "Análisis de cafeterías");
  assert.equal(research.status, "draft");
  assert.equal(research.country, "Ecuador");
  assert.equal(research.city, "Loja");
  assert.equal(Object.isFrozen(research), true);
});

test("allows city to be omitted", () => {
  const research = createResearch({ ...validInput, city: "" });
  assert.equal(research.city, null);
});

test("rejects missing required fields", () => {
  assert.throws(() => createResearch({ ...validInput, title: " " }), /título es obligatorio/);
});

test("rejects unsupported status", () => {
  assert.throws(() => createResearch({ ...validInput, status: "published" }), /estado.*no es válido/);
});

test("validates known research statuses", () => {
  assert.equal(isResearchStatus("draft"), true);
  assert.equal(isResearchStatus("completed"), true);
  assert.equal(isResearchStatus("unknown"), false);
});