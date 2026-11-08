# Baseline de rendimiento — Radar Comercial

## Resultado validado en CI

- Ejecución de referencia anterior: [GitHub Actions #253](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42447192678)
- PostgreSQL: 16
- Dataset aislado por workspace: 500 productos y 2.500 observaciones de precios
- Rutas medidas: listado de productos e historial de precios
- Incluye autorización real de membresía contra PostgreSQL
- Calentamiento: 10 solicitudes

La primera medición, con 20 solicitudes simultáneas y 100 solicitudes medidas, obtuvo:

| Métrica | Resultado |
|---|---:|
| P50 | 19,69 ms |
| P95 | 46,97 ms |
| P99 | 51,63 ms |
| Máximo | 55,88 ms |
| Throughput | 822,30 solicitudes/s |
| Umbral de aprobación P95 | 1.000 ms |

## Benchmark escalonado

El benchmark ahora ejecuta escenarios independientes con concurrencias de **1, 5, 20 y 50** (por defecto, cinco solicitudes por trabajador). Cada escenario informa P50, P95, P99, máximo, throughput y tiempo total. La ejecución falla si algún escenario supera el umbral P95 configurado.

Los resultados de esta nueva matriz se incorporarán aquí después de que CI ejecute el cambio. No se deben confundir con la medición de referencia anterior.

## Alcance y límites

La medición usa `Fastify.inject()` en el runner de GitHub Actions y un servicio PostgreSQL 16. Evalúa las rutas HTTP dentro del proceso, la autorización y las consultas de base de datos bajo concurrencia, pero no mide latencia de red externa, TLS, proxy, balanceador ni infraestructura de producción.

Los resultados son una línea base reproducible del entorno CI; **no constituyen una garantía de capacidad de producción** ni sustituyen una prueba de carga en staging con recursos equivalentes a producción.

## Reproducir

Configura `TEST_DATABASE_URL` apuntando a una base PostgreSQL de pruebas aislada y ejecuta:

```bash
npm run perf
```

Variables opcionales:

- `PERF_CONCURRENCY_LEVELS`: niveles separados por comas (por defecto `1,5,20,50`; rango individual 1–100).
- `PERF_CONCURRENCY`: compatibilidad con la ejecución de un único nivel; se usa si no se define `PERF_CONCURRENCY_LEVELS`.
- `PERF_ITERATIONS`: solicitudes por trabajador y nivel (por defecto 5; rango 1–100).
- `PERF_P95_MAX_MS`: umbral P95 en milisegundos (por defecto 1.000).

El script crea y elimina sus propios datos de prueba. No debe apuntarse a una base de datos de producción.

## Siguiente validación operativa

Antes de declarar capacidad productiva, ejecutar pruebas con red real y staging, ampliar gradualmente el dataset, observar conexiones del pool y recursos de PostgreSQL, y establecer objetivos SLO acordes al hosting contratado.
