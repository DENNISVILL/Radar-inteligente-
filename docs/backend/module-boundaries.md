# Límites de módulos del backend

Radar Comercial usa un monolito modular. Los módulos se separan por responsabilidad de negocio, no por crear carpetas vacías. Cada capa debe contener lógica real y pruebas.

## Módulos existentes en la rama backend/foundation

- `identity`: identidad autenticada, workspaces, membresías e invitaciones.
- `research`: ciclo de vida de investigaciones.
- `market-intelligence`: competidores, productos, precios y observaciones comerciales (módulo legado que se irá descomponiendo por capacidad sin romper rutas existentes).
- `market-analysis`: consultas de análisis descriptivo y reglas puras para convertir evidencia registrada en sugerencias revisables.
- `health`: liveness y readiness del servicio.

## Contrato de capas para nuevos módulos

- `domain/`: reglas puras y entidades; no importa Fastify ni PostgreSQL.
- `application/`: casos de uso y coordinación de repositorios/servicios.
- `infrastructure/`: persistencia e integraciones externas.
- `presentation/`: rutas HTTP, controladores y validación de transporte.
- `tests/modules/<módulo>/`: pruebas unitarias y HTTP del comportamiento.

No se crea una capa hasta que exista código que le corresponda. Las rutas y contratos públicos se mantienen compatibles durante cada extracción; la descomposición se entrega por módulos funcionales, no mediante movimientos masivos sin pruebas.

## Extracción realizada: market-analysis

La API existente `GET /api/v1/workspaces/:workspaceId/researches/:researchId/analysis` conserva su contrato. Las consultas SQL viven en `application/market-analysis.js`; las reglas de sugerencias y comparación de precios viven en `domain/market-analysis.js`. Ambas capas tienen pruebas propias. La implementación antigua se reexporta temporalmente desde `market-intelligence/application/market-intelligence.js` para no romper consumidores internos heredados.
