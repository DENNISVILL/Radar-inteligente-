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

Resultados validados en [GitHub Actions #259](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42447656974), commit `d4cc1aaf20defa588aa4073cc1600c87a3f8fa01`:

| Concurrencia | Solicitudes | P50 | P95 | P99 | Máximo | Throughput |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 1,21 ms | 1,54 ms | 1,54 ms | 1,54 ms | 785,01 req/s |
| 5 | 25 | 3,18 ms | 17,90 ms | 18,53 ms | 18,53 ms | 788,97 req/s |
| 20 | 100 | 15,51 ms | 26,35 ms | 59,33 ms | 66,19 ms | 1.049,43 req/s |
| 50 | 250 | 32,65 ms | 39,52 ms | 40,90 ms | 43,75 ms | 1.492,54 req/s |

Los cuatro escenarios cumplieron el umbral P95 de 1.000 ms. CI también completó 189 pruebas (0 fallidas), validación OpenAPI y revisión de sintaxis. Estos valores pertenecen al runner CI y no deben compararse directamente con latencia de producción.

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


## Validación más reciente — CI #275

- [CI #275 aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42478835207).
- 191 pruebas aprobadas, 0 fallidas.
- Dataset: 500 productos y 2.500 observaciones de precios; 5 iteraciones por trabajador.
- Concurrencia 1: 5 solicitudes; P95 2,39 ms; 618,52 req/s.
- Concurrencia 5: 25 solicitudes; P95 21,91 ms; 649,26 req/s.
- Concurrencia 20: 100 solicitudes; P95 26,06 ms; 906,73 req/s.
- Concurrencia 50: 250 solicitudes; P95 46,60 ms; 1.199,74 req/s.
- Todos los escenarios cumplieron el umbral automatizado P95 de 1.000 ms.
- Medición en CI con Fastify.inject() y PostgreSQL 16; no representa latencia de red ni capacidad garantizada de producción.


## Validación más reciente — CI #298

- [CI #298 aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42479082477).
- 192 pruebas aprobadas, 0 fallidas.
- Dataset: 500 productos y 2.500 observaciones de precios; 5 iteraciones por trabajador.
- Concurrencia 1: 5 solicitudes; P95 1,41 ms; 854,62 req/s.
- Concurrencia 5: 25 solicitudes; P95 15,82 ms; 888,36 req/s.
- Concurrencia 20: 100 solicitudes; P95 24,09 ms; 1.194,33 req/s.
- Concurrencia 50: 250 solicitudes; P95 35,20 ms; 1.620,96 req/s.
- Todos los escenarios cumplieron el umbral automatizado P95 de 1.000 ms.
- Medición en CI con Fastify.inject() y PostgreSQL 16; no representa latencia de red ni capacidad garantizada de producción.


## Validación más reciente — CI #346

- [CI #346 aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42480259690).
- 198 pruebas aprobadas, 0 fallidas.
- Dataset: 500 productos y 2.500 observaciones de precios; 5 iteraciones por trabajador.
- Concurrencia 1: 5 solicitudes; P95 1,48 ms; 797,77 req/s.
- Concurrencia 5: 25 solicitudes; P95 16,23 ms; 790,90 req/s.
- Concurrencia 20: 100 solicitudes; P95 21,53 ms; 1.144,91 req/s.
- Concurrencia 50: 250 solicitudes; P95 38,56 ms; 1.506,04 req/s.
- Todos los escenarios cumplieron el umbral automatizado P95 de 1.000 ms.
- Medición en CI con Fastify.inject() y PostgreSQL 16; no representa latencia de red ni capacidad garantizada de producción.


## Validación más reciente — CI #352

- [CI #352 aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42480447270).
- 199 pruebas aprobadas, 0 fallidas.
- Dataset: 500 productos y 2.500 observaciones de precios; 5 iteraciones por trabajador.
- Concurrencia 1: 5 solicitudes; P95 1,70 ms; 830,78 req/s.
- Concurrencia 5: 25 solicitudes; P95 16,96 ms; 827,19 req/s.
- Concurrencia 20: 100 solicitudes; P95 23,52 ms; 1.195,69 req/s.
- Concurrencia 50: 250 solicitudes; P95 34,52 ms; 1.665,20 req/s.
- Todos los escenarios cumplieron el umbral automatizado P95 de 1.000 ms.
- Medición en CI con Fastify.inject() y PostgreSQL 16; no representa latencia de red ni capacidad garantizada de producción.
