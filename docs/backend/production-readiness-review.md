# Revisión de preparación operativa — Radar Comercial

**Fecha de revisión:** 2026-11-08  
**Rama revisada:** `backend/foundation`  
**Alcance:** inspección estática de configuración, servidor, pool PostgreSQL, rate limiting, health/readiness, migraciones, observabilidad, CI y documentación.  
**Dictamen:** backend funcional y con CI aprobada; **no apto todavía para despliegue productivo abierto**.

## 1. Evidencia verificada

- CI #259: [ejecución aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42447656974).
- 189 pruebas aprobadas y 0 fallidas.
- PostgreSQL 16 de servicio en CI.
- Benchmark escalonado con 1, 5, 20 y 50 trabajadores; todos los escenarios cumplieron el umbral P95 de 1.000 ms.
- OpenAPI validado y comprobación de sintaxis aprobada.
- Health y readiness implementados; readiness ejecuta `SELECT 1` y responde 503 si PostgreSQL no está disponible.
- Cierre ordenado del servidor y pool ante SIGINT/SIGTERM.
- Migraciones serializadas con advisory lock y transacción individual por migración.
- Rate limiting actual por IP/ruta en memoria, no compartido entre instancias.
- Métricas HTTP Prometheus y correlación básica de trazas; no hay exportador OpenTelemetry ni sistema de alertas configurado.

## 2. Hallazgos y acciones

| Prioridad | Hallazgo | Estado actual | Acción para cerrar |
|---|---|---|---|
| Crítica antes de usuarios reales | Aceptación de invitaciones no exige claim de correo verificado | El verificador JWT expone subject y email, pero no valida/expone `email_verified` | Conectar el proveedor real, confirmar el claim exacto y exigir correo verificado coincidente; agregar pruebas negativas y positivas |
| Alta | No hay copias automáticas ni restauración probada | No existe infraestructura de backup/restore configurada en el repositorio | Elegir hosting/servicio PostgreSQL, definir RPO/RTO, automatizar backups cifrados y ejecutar una restauración documentada |
| Alta | Rate limiter no distribuido | Contadores en memoria por proceso | Antes de ejecutar más de una instancia, usar Redis u otro almacén compartido con límites atómicos |
| Alta | Métricas expuestas por ruta sin autenticación propia | `/metrics` se registra cuando `METRICS_ENABLED=true` | Mantenerlo en red privada o restringirlo en proxy/firewall; verificar que no quede expuesto públicamente |
| Alta | Sin alertas ni política de retención | Logs y métricas se generan, pero no hay destino/alertas configurados | Definir proveedor de observabilidad, alertas de errores/latencia/DB/429, retención y responsables |
| Alta | Privilegios y conectividad de PostgreSQL no verificados en entorno real | Pool configurado con máximo 10 conexiones; TLS opcional vía `DB_SSL` | Crear rol de mínimo privilegio, restringir red, activar TLS con certificados verificados y dimensionar pool según límite del hosting |
| Media | Proxy de confianza depende del despliegue | Fastify no habilita `trustProxy` en la configuración actual | Mantener desactivado salvo necesidad; si se usa proxy, confiar solo en IPs/CIDRs del proxy administrado |
| Media | Prueba de rendimiento es in-process | Usa `Fastify.inject()` y PostgreSQL en runner CI | Repetir en staging con red, TLS, proxy, recursos y pool equivalentes a producción |
| Media | Política de despliegue/migración no documentada | Migraciones se serializan y aplican transaccionalmente; no hay procedimiento de backup previo/rollback operativo | Documentar ventana, backup previo, compatibilidad hacia atrás y recuperación ante migración fallida |

## 3. Controles que sí existen

- `/health` para liveness y `/ready` para comprobar PostgreSQL.
- Límite de cuerpo HTTP de 1 MiB y timeout de solicitud de 15 segundos.
- Pool PostgreSQL con timeout de conexión de 5 segundos y cierre ordenado.
- SSL de PostgreSQL configurable con validación de certificado cuando se activa.
- Fastify no confía por defecto en cabeceras de proxy.
- Rate limit por IP/ruta con cabeceras RateLimit y respuesta 429.
- Logs estructurados con redacción de Authorization y Cookie.
- Endpoint de métricas con rutas registradas como etiquetas para limitar cardinalidad.
- Migraciones protegidas con advisory lock y transacciones.
- CI ejecuta pruebas PostgreSQL, benchmark, OpenAPI y sintaxis.

## 4. Orden recomendado de cierre

1. **Identidad:** conectar Supabase real y cerrar la verificación de correo en invitaciones.
2. **Base de datos:** decidir proveedor/hosting, rol SQL mínimo, TLS, red privada, límites de conexiones y backups.
3. **Recuperación:** realizar una restauración de prueba y registrar el procedimiento; un backup no se considera validado hasta restaurarlo.
4. **Exposición de servicio:** decidir acceso a `/metrics`, proxy confiable, TLS público, secretos y límites compartidos.
5. **Observabilidad:** configurar destino de logs/métricas, alertas, retención y respuesta a incidentes.
6. **Staging:** ejecutar prueba de carga de red real y pruebas de aceptación/seguridad antes de abrir acceso público.

## 5. Decisiones que requieren al propietario

No se deben inventar ni simular estas decisiones: proveedor de hosting, servicio PostgreSQL, dominio, presupuesto, proveedor de correo, proyecto Supabase y política de retención. Hasta que estén definidos, estas tareas permanecen pendientes.

## 6. Conclusión

El cierre de 29/29 entregables describe la fase principal de construcción del backend, no la preparación integral para producción. La validación CI #259 confirma la calidad automatizada del código actual, pero no sustituye la configuración de infraestructura, recuperación, seguridad externa ni pruebas de staging.
