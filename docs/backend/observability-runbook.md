# Runbook de observabilidad y alertas — Radar Comercial

**Estado:** guía operativa propuesta; no implica que exista un proveedor de monitorización conectado.  
**Alcance:** métricas HTTP Prometheus, logs estructurados, trazas W3C y comprobaciones externas.

## 1. Estado real de la instrumentación

La API incorpora:

- `radar_http_requests_total{method,route,status}`: contador HTTP por método, plantilla de ruta y código de respuesta.
- `radar_http_request_duration_seconds`: histograma de duración HTTP en segundos.
- `radar_http_requests_active`: solicitudes activas dentro del proceso.
- `x-trace-id` y `traceparent`: identificadores de correlación; si el `traceparent` entrante no es válido, se genera un contexto nuevo.
- Logs JSON del logger Fastify y evento `request completed` con método, ruta, estado, duración y trace ID. Authorization y Cookie están configurados para redacción.

`/metrics` está deshabilitado por defecto. Para habilitarlo se requiere `METRICS_ENABLED=true`. Si se habilita, debe exponerse solo a la red privada de monitorización o mediante un proxy con control de acceso; nunca publicarlo abiertamente en Internet.

Las métricas son locales al proceso: se reinician al reiniciar la API y no se agregan entre réplicas por sí solas. No existe actualmente exportador OpenTelemetry, almacenamiento remoto, dashboard, sistema de alertas, métrica de pool PostgreSQL ni métrica interna de antigüedad del último backup. Estas capacidades requieren infraestructura externa.

## 2. Consultas Prometheus de referencia

Ajustar el selector `job="radar-api"` al nombre real del scrape job.

### Tasa de errores HTTP 5xx

```promql
sum(rate(radar_http_requests_total{job="radar-api",status=~"5.."}[5m]))
/
clamp_min(sum(rate(radar_http_requests_total{job="radar-api"}[5m])), 1)
```

Umbral inicial sugerido: mayor a 5% durante 10 minutos, con tráfico suficiente. Tratarlo como punto de partida y calibrarlo con datos de staging.

### Latencia HTTP p95

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(radar_http_request_duration_seconds_bucket{job="radar-api"}[5m])
  )
)
```

Umbral inicial sugerido: p95 superior a 1 segundo durante 10 minutos. Separar por ruta solo en paneles de diagnóstico; evitar alertas por cada ruta de bajo tráfico.

### Solicitudes activas

```promql
radar_http_requests_active{job="radar-api"}
```

Usar como señal de saturación junto con latencia, 5xx y uso de CPU/memoria del proveedor. No establecer un umbral universal hasta conocer recursos y concurrencia del despliegue.

### Disponibilidad del scrape

```promql
up{job="radar-api"}
```

Alertar si el scrape falla durante 2–5 minutos. El scrape correcto no sustituye una prueba HTTP externa de disponibilidad.

## 3. Alertas externas obligatorias antes de producción

| Señal | Comprobación | Respuesta inicial |
|---|---|---|
| API no disponible | Probe HTTP externo a `/health` | Revisar proceso, despliegue, DNS, TLS y proxy |
| API no lista | Probe HTTP externo a `/ready`; esperar HTTP 200 | Revisar PostgreSQL, conectividad, pool y credenciales |
| Errores elevados | Ratio 5xx anterior | Correlacionar por trace ID; revisar cambios y dependencia afectada |
| Latencia elevada | p95 anterior | Revisar consultas SQL, pool, CPU, red y dependencias |
| PostgreSQL saturado | Métricas del proveedor/DBA: conexiones, bloqueos, CPU, almacenamiento | Comparar conexiones con límite y pool configurado |
| Backup atrasado o fallido | Estado del proveedor de backup y antigüedad del último backup exitoso | No asumir que existe respaldo utilizable; ejecutar verificación y restauración controlada |
| Restauración fallida | Resultado de ejercicio periódico de restore en entorno aislado | Bloquear despliegue hasta recuperar un respaldo válido |
| Fallos de autenticación del proveedor | 5xx de API y logs de errores Auth/JWKS | Verificar estado del proveedor, red y configuración; no desactivar fail-closed |

Las señales de PostgreSQL, backup y restauración deben venir del proveedor o de un monitor externo: Radar no las expone como métricas Prometheus actualmente.

## 4. Procedimiento de respuesta

1. Registrar hora, alerta, entorno, versión desplegada y alcance de usuarios afectados.
2. Comprobar `/health` y `/ready` desde fuera de la red del proceso.
3. Consultar tasa 5xx, p95 y solicitudes activas; agrupar por ruta y correlacionar con `x-trace-id`.
4. Revisar logs sin copiar tokens, cookies, claves ni cadenas de conexión a tickets o chats.
5. Si el problema coincide con una migración o despliegue, detener nuevas promociones y aplicar el procedimiento de reversión/recuperación aprobado.
6. Para incidentes de base de datos o pérdida de datos, preservar evidencia y validar un backup antes de cualquier restauración. Restaurar primero en una base aislada.
7. Documentar causa, impacto, mitigación y acción preventiva.

## 5. Retención, acceso y validación

- Definir retención de logs y métricas según obligaciones legales, costo y necesidad operativa antes de producción; no hay una retención configurada por el repositorio.
- Restringir dashboards, logs, métricas y trazas por rol. No incluir datos personales, tokens, cookies, contraseñas ni payloads sensibles como etiquetas.
- Mantener etiquetas métricas limitadas a método, plantilla de ruta y estado HTTP. No añadir workspace ID, usuario, URL completa, query string, email ni IP como labels.
- Probar las alertas en staging con fallos controlados y confirmar que llega una notificación a un responsable definido.
- Registrar proveedor, responsables, canales de notificación, horarios de cobertura y escalamiento en el runbook del entorno final.

## 6. Bloqueos de producción

Este documento no constituye una configuración activa de monitoreo. Antes de declarar observabilidad operativa se necesita seleccionar y configurar el proveedor, almacenamiento remoto, scrape seguro, alertas, retención, canales de notificación y responsables; después se deben probar en staging.