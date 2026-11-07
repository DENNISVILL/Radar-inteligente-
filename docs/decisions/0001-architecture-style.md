# ADR 0001: estilo arquitectónico inicial

- **Estado:** aceptado provisionalmente
- **Fecha:** 2026-11-07
- **Decisión:** comenzar con un monolito modular.

## Contexto

El producto está en etapa inicial y aún no tiene carga, equipo ni necesidades operativas que justifiquen servicios distribuidos. La prioridad es mantener bajo el coste y la complejidad, sin perder límites internos claros.

## Consecuencias

- Un despliegue inicial y una operación más sencilla.
- Módulos separados por responsabilidad y contratos públicos.
- Pruebas unitarias por módulo e integración en los límites.
- No introducir microservicios, colas ni infraestructura adicional sin un caso de uso medible.

## Revisión

La decisión se revisará cuando existan métricas de uso, necesidades de escalado o requisitos de aislamiento que justifiquen cambiarla.