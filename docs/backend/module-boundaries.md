# Módulos y límites del backend

Radar Comercial se organiza como monolito modular. Cada módulo representa una responsabilidad de negocio con código y pruebas reales; no se crean directorios vacíos para aparentar cobertura.

## Módulos con límites explícitos

- `identity`: identidad, workspaces, membresías e invitaciones.
- `research`: ciclo de vida de investigaciones.
- `market-intelligence`: competidores, productos y precios; módulo legado en proceso de extracción por capacidad.
- `market-evidence`: validación y persistencia de observaciones comerciales ligadas a investigación, workspace y actor.
- `market-analysis`: consultas descriptivas y reglas puras para sugerencias de revisión.
- `health`: liveness y readiness.

## Capas

- `domain/`: reglas puras, sin Fastify ni PostgreSQL.
- `application/`: casos de uso y acceso a datos mediante interfaces de consulta.
- `infrastructure/`: adaptadores de persistencia e integraciones cuando sean necesarios.
- `presentation/`: rutas HTTP y validación del transporte.
- `tests/modules/<módulo>/`: pruebas unitarias, de aplicación y HTTP.

No todas las capacidades necesitan una carpeta por capa desde el primer commit. Se agrega cada capa cuando contiene código real. Las rutas públicas se conservan durante las extracciones para no romper el frontend.

## Extracciones completadas

### market-analysis

- `domain/market-analysis.js`: reglas puras de sugerencias basadas en conteos de evidencia y comparación de últimos precios por moneda.
- `application/market-analysis.js`: consultas PostgreSQL acotadas simultáneamente por workspace e investigación.
- La ruta de análisis existente mantiene el contrato.

### market-evidence

- `domain/observation.js`: validación de tipos, texto, fecha real, confianza y URL HTTP/HTTPS.
- `application/observations.js`: creación y consulta con workspace, investigación y actor suministrados por el servidor.
- Los endpoints existentes de observaciones conservan sus URLs y respuestas.
