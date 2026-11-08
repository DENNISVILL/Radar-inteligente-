# Radar Comercial

Plataforma de investigación e inteligencia comercial para organizar evidencia, comparar competidores y generar informes trazables.

## Estado del proyecto

El backend está en desarrollo y cuenta con una base funcional: autenticación mediante JWT de Supabase (pendiente de conectar un proyecto real), espacios de trabajo multiempresa, roles y membresías, invitaciones, investigaciones, registros de mercado, informes versionados y exportación PDF.

**Todavía no es un producto listo para producción.** No hay frontend, despliegue productivo ni proveedor de correo conectado.

## Stack

- Node.js 22+
- Fastify 5
- PostgreSQL 16 o compatible
- `pg` para persistencia y migraciones SQL
- Supabase Auth/JWKS como proveedor de identidad, cuando se configure el proyecto
- Node.js Test Runner y GitHub Actions

## Desarrollo local

1. Instala Node.js 22+ y PostgreSQL.
2. Copia `.env.example` a `.env` y configura `DATABASE_URL`. Para desarrollo local puedes usar la misma base en `MIGRATION_DATABASE_URL`; en producción deben ser credenciales distintas.
3. Ejecuta `npm install`.
4. Ejecuta `npm run db:migrate` con `MIGRATION_DATABASE_URL`.
5. Inicia con `npm run dev`; el servidor usa únicamente `DATABASE_URL`.

Comandos disponibles: `npm test`, `npm run check`, `npm run perf`, `npm run db:backup` y `npm run db:restore`. Los comandos de respaldo/restauración requieren `pg_dump` y `pg_restore`; consulta `docs/backend/backup-and-recovery.md` antes de usarlos.

Rutas de salud: `GET /health` y `GET /ready`. Métricas Prometheus: `GET /metrics` (deshabilitado por defecto; habilitar explícitamente con `METRICS_ENABLED=true` solo en una red privada o tras restringir el acceso en el proxy/firewall).

## PostgreSQL y privilegios

La API usa `DATABASE_URL` con el rol `radar_runtime`; el comando `npm run db:migrate` usa `MIGRATION_DATABASE_URL` con el rol `radar_migration_owner`. En producción la credencial de migraciones es obligatoria y no se permite reutilizar la conexión de runtime. El rol runtime no puede crear objetos, leer/modificar auditoría ni consultar el historial de migraciones. Consulta `docs/backend/postgresql-roles.md` y `database/roles/production-roles.sql` para el aprovisionamiento de una base nueva.

## Observabilidad

- Logs JSON estructurados de Fastify con redacción de `Authorization` y cookies.
- Cada respuesta incluye `x-trace-id`; acepta `traceparent` W3C válido y genera un span ID de servidor para correlación. No sustituye todavía una integración OpenTelemetry/exportador distribuido.
- `GET /metrics` expone contadores HTTP, histogramas de latencia y solicitudes activas en formato Prometheus. Usa rutas registradas como etiquetas para evitar cardinalidad por URL/ID; no registra el endpoint de métricas.
- El endpoint está desactivado por defecto para evitar exposición accidental. Para habilitarlo, configura `METRICS_ENABLED=true` únicamente cuando la ruta esté protegida por red privada o por reglas de proxy/firewall; no tiene autenticación propia.

## Capacidades del backend

- Identidad y autorización por workspace.
- Roles `owner`, `admin`, `analyst` y `viewer`.
- Gestión de miembros e invitaciones de un solo uso, con vencimiento, revocación y auditoría.
- Investigaciones, competidores, productos/servicios, observaciones y registros de precios.
- Informes comerciales con snapshots versionados, historial, verificación de integridad y exportación PDF.
- Comparación descriptiva de los dos precios más recientes por producto y moneda, sin extrapolación ni predicción; requiere fechas de observación distintas.
- Aislamiento de datos por workspace y validación de relaciones entre entidades.

Los análisis actuales son descriptivos y dependen de los datos y fuentes que se registren. No se presentan como predicciones verificadas ni como vigilancia automática de sitios externos.

## Seguridad y límites conocidos

- Nunca subas archivos `.env`, contraseñas, claves privadas ni tokens.
- La API valida JWT mediante JWKS, pero requiere configurar `SUPABASE_URL` y un proyecto Supabase real. Los tokens inválidos reciben 401; si el proveedor JWKS no está disponible temporalmente, la API responde 503 sin confundir la incidencia con credenciales inválidas.
- Las invitaciones devuelven el token una sola vez al usuario que las crea. Sin proveedor de correo, su entrega es manual y debe realizarse por un canal seguro.
- La API incluye límites por IP y ruta: 120 solicitudes por ventana de 60 segundos por defecto y 10 para aceptar invitaciones; `/health` y `/ready` quedan excluidos. Es un control en memoria por proceso, no distribuido: al escalar a varias instancias debe sustituirse o complementarse con un almacén compartido. Si se despliega detrás de un proxy, la confianza en cabeceras de IP debe configurarse explícitamente y con proxies confiables.
- No hay todavía frontend, despliegue productivo ni políticas RLS configuradas en un proyecto Supabase.
- Los hashes de integridad ayudan a detectar cambios, pero no equivalen a firmas digitales ni sustituyen controles de acceso.

Consulta `docs/backend/implementation-plan.md` para ver el avance; `docs/backend/performance-baseline.md` para la medición de rendimiento; y `docs/backend/backup-and-recovery.md` para el procedimiento de respaldo y recuperación.

### Ciclo de vida de autenticación y sesiones
- La API acepta únicamente access tokens Bearer; no recibe ni almacena refresh tokens. El cliente oficial de Supabase Auth administra la renovación de sesión y debe enviar el access token vigente en cada solicitud.
- Se validan firma JWKS, algoritmo permitido, emisor, audiencia, `sub`, `iat`, `exp` y `session_id`; se exige una antigüedad máxima configurable mediante `SUPABASE_JWT_MAX_AGE_SECONDS` (por defecto 3600; rango 300–86400 segundos).
- Al configurar `SUPABASE_URL`, también se exige `SUPABASE_PUBLISHABLE_KEY` (preferida) o `SUPABASE_ANON_KEY` heredada. La API consulta `GET /auth/v1/user` en cada solicitud autenticada para comprobar que la sesión sigue siendo reconocida por Auth y obtiene el correo y su estado de confirmación desde el proveedor. No se acepta una clave `service_role` para esta función.
- Si Supabase rechaza la sesión, la API devuelve 401; si Auth no responde o devuelve un error temporal, devuelve 503 y falla de forma cerrada. No se hace fallback a aceptar el JWT localmente.
- Una cuenta local con estado `disabled` recibe 403. Aceptar invitaciones requiere que Supabase confirme el correo cuando la validación remota está habilitada.
- El frontend deberá usar `supabase.auth.refreshSession()` / el mecanismo automático del SDK y `supabase.auth.signOut()`; la API no expone un endpoint de refresh ni de logout porque no gestiona refresh tokens.
- Los JWT son stateless: un token emitido puede seguir siendo válido hasta `exp` después de un cierre de sesión. La validación remota de sesión por solicitud reduce esa ventana al rechazar sesiones que Auth ya no reconoce. Se debe mantener el tiempo de vida del JWT en Supabase alineado con el máximo configurado en Radar.
