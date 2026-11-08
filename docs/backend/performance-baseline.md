# Baseline de rendimiento — Radar Comercial

## Resultado validado en CI

- Ejecución: [GitHub Actions #253](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42447192678)
- Commit: `4dc87d0dea1a04862183c62c54dfcb21b2e2dc32`
- PostgreSQL: 16
- Dataset aislado por workspace: 500 productos y 2.500 observaciones de precios
- Rutas medidas: listado de productos y consulta del historial de precios
- Incluye autorización real de membresía contra PostgreSQL
- Calentamiento: 10 solicitudes
- Muestra medida: 100 solicitudes
- Concurrencia: 20 solicitudes simultáneas
- Resultado: 189 pruebas funcionales aprobadas y baseline de rendimiento aprobado

| Métrica | Resultado |
|---|---:|
| P50 | 19,69 ms |
| P95 | 46,97 ms |
| P99 | 51,63 ms |
| Máximo | 55,88 ms |
| Throughput | 822,30 solicitudes/s |
| Umbral de aprobación P95 | 1.000 ms |

## Alcance y límites

La medición usa `Fastify.inject()` en el runner de GitHub Actions y un servicio PostgreSQL 16. Evalúa la ruta HTTP, la autorización y las consultas de base de datos bajo concurrencia, pero no mide latencia de red externa, TLS, proxy, balanceador ni infraestructura de producción.

Los resultados son una línea base reproducible del entorno CI; **no constituyen una garantía de capacidad de producción** ni sustituyen una prueba de carga en staging con recursos equivalentes a producción.

## Reproducir

Configura `TEST_DATABASE_URL` apuntando a una base PostgreSQL de pruebas aislada y ejecuta:

```bash
npm run perf
```

Variables opcionales:

- `PERF_CONCURRENCY`: concurrencia (por defecto 20; rango 1–100).
- `PERF_ITERATIONS`: solicitudes por trabajador (por defecto 5; rango 1–100).
- `PERF_P95_MAX_MS`: umbral P95 en milisegundos (por defecto 1.000).

El script crea y elimina sus propios datos de prueba. No debe apuntarse a una base de datos de producción.

## Siguiente validación operativa

Antes de declarar capacidad productiva, ejecutar pruebas con red real y staging, ampliar gradualmente el dataset, probar varios niveles de concurrencia, observar conexiones del pool y recursos de PostgreSQL, y establecer objetivos SLO acordes al hosting contratado.
