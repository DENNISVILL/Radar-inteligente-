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
2. Copia `.env.example` a `.env` y configura `DATABASE_URL`.
3. Ejecuta `npm install`.
4. Ejecuta `npm run db:migrate`.
5. Inicia con `npm run dev`.

Comandos disponibles: `npm test`, `npm run check`, `npm run perf` (baseline de rendimiento con `TEST_DATABASE_URL`) y `npm start`.

Rutas de salud: `GET /health` y `GET /ready`. Métricas Prometheus: `GET /metrics` (deshabilitado por defecto; habilitar explícitamente con `METRICS_ENABLED=true` solo en una red privada o tras restringir el acceso en el proxy/firewall).

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
- Informes comerciales con snapshots versionados, historial, verificación de integridad y exportación PDF.\n- Comparación descriptiva de los dos precios más recientes por producto y moneda, sin extrapolación ni predicción; requiere fechas de observación distintas.
- Aislamiento de datos por workspace y validación de relaciones entre entidades.

Los análisis actuales son descriptivos y dependen de los datos y fuentes que se registren. No se presentan como predicciones verificadas ni como vigilancia automática de sitios externos.

## Seguridad y límites conocidos

- Nunca subas archivos `.env`, contraseñas, claves privadas ni tokens.
- La API valida JWT mediante JWKS, pero requiere configurar `SUPABASE_URL` y un proyecto Supabase real.
- Las invitaciones devuelven el token una sola vez al usuario que las crea. Sin proveedor de correo, su entrega es manual y debe realizarse por un canal seguro.
- La API incluye límites por IP y ruta: 120 solicitudes por ventana de 60 segundos por defecto y 10 para aceptar invitaciones; `/health` y `/ready` quedan excluidos. Es un control en memoria por proceso, no distribuido: al escalar a varias instancias debe sustituirse o complementarse con un almacén compartido. Si se despliega detrás de un proxy, la confianza en cabeceras de IP debe configurarse explícitamente y con proxies confiables.
- No hay todavía frontend, despliegue productivo ni políticas RLS configuradas en un proyecto Supabase.
- Los hashes de integridad ayudan a detectar cambios, pero no equivalen a firmas digitales ni sustituyen controles de acceso.

Consulta `docs/backend/implementation-plan.md` para ver el avance y los pendientes, y `docs/backend/performance-baseline.md` para reproducir y entender la medición de rendimiento.
