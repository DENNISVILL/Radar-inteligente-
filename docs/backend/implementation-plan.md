# Plan de implementación de Radar Comercial

## Avance exclusivo del backend (sin frontend ni despliegue de base de datos)

Este porcentaje mide únicamente el trabajo de API, lógica de aplicación, validación, autorización, pruebas y operación del servicio. No incluye el frontend ni la conexión de un proyecto Supabase real.

### Funcionalidad backend — completada
- [x] Servidor Fastify, configuración, arranque y cierre ordenado.
- [x] Manejo centralizado de errores, límites de cuerpo y timeout HTTP.
- [x] Endpoints de salud y disponibilidad.
- [x] Pool y acceso a PostgreSQL desde la aplicación.
- [x] Módulo de verificación JWT/JWKS preparado para Supabase.
- [x] Resolución de identidad local y aislamiento por workspace.
- [x] Autorización por roles.
- [x] Creación y consulta de workspaces.
- [x] Gestión de miembros y restricciones del último owner.
- [x] Ciclo de invitaciones y auditoría; revalidación del rol del actor dentro de la transacción para altas/cambios/bajas y operaciones de invitación.
- [x] CRUD de investigaciones.
- [x] CRUD de competidores.
- [x] CRUD de productos/servicios.
- [x] Registro y consulta de precios.
- [x] Registro y consulta de observaciones.
- [x] Análisis descriptivo de mercado.
- [x] Generación de informes comerciales.
- [x] Snapshots versionados e historial.
- [x] Exportación PDF.
- [x] Auditoría de operaciones.
- [x] Rate limiting configurable por IP/ruta, con capacidad máxima de buckets, limpieza de ventanas expiradas y rechazo 503 temporal cuando se alcanza la capacidad sin expulsar ventanas activas.
- [x] Pruebas unitarias y HTTP de módulos principales.
- [x] Pruebas de integración del backend contra PostgreSQL en CI, incluidas pruebas concurrentes de roles y membresías y consumo único de invitaciones.

### Trabajo backend pendiente
- [x] Contrato OpenAPI 3.1 y validación formal automatizada en CI con Redocly.
- [x] Matriz ampliada de pruebas HTTP para permisos, errores y aislamiento multiempresa en todos los módulos.
- [x] Pruebas de concurrencia PostgreSQL para cambios simultáneos de roles y altas de membresías.
- [x] Revisión estática de seguridad y modelo de amenazas documentados en `docs/security/threat-model.md`; quedan acciones de cierre antes de producción.
- [x] Métricas HTTP Prometheus, histogramas de latencia, correlación W3C traceparent, identificadores de traza y logs estructurados; validados en CI.
- [x] Baseline de rendimiento HTTP con PostgreSQL 16, 500 productos, 2.500 observaciones, 20 solicitudes simultáneas y umbral P95; resultados en `docs/backend/performance-baseline.md`.

**Criterio del porcentaje:** 29 de 29 entregables principales de esta fase backend completados = 100 %. Este cierre no significa que el producto esté listo para producción: siguen pendientes alertas, recuperación probada, integraciones externas, frontend y despliegue.


## Preparación operativa antes de producción — pendiente

El 100 % de los 29 entregables principales no incluye el cierre de infraestructura ni el despliegue. La revisión operativa está documentada en `docs/backend/production-readiness-review.md`.

- [x] Health/readiness y cierre ordenado del servidor/pool.
- [x] Migraciones serializadas con advisory lock y transacciones.
- [x] Métricas HTTP, correlación básica de trazas y logs estructurados.
- [ ] Conectar Supabase real y exigir correo verificado al aceptar invitaciones.
- [ ] Elegir hosting y PostgreSQL administrado; configurar TLS, red privada y rol SQL de mínimo privilegio.
- [ ] Configurar backups automáticos y completar una restauración de prueba con RPO/RTO definidos.
- [x] `/metrics` deshabilitado por defecto; si se habilita explícitamente, restringirlo a red privada o acceso autenticado en infraestructura.
- [ ] Configurar alertas, retención de logs/métricas y procedimiento de incidentes.
- [ ] Sustituir rate limiting en memoria por almacenamiento compartido antes de escalar a varias instancias.
- [ ] Ejecutar prueba de carga de red real y aceptación de seguridad en staging.

### Cierre técnico de los puntos 32–33 — 2026-11-08

- [x] Documentar métricas Prometheus existentes, consultas de referencia, umbrales iniciales y procedimiento de respuesta en `docs/backend/observability-runbook.md`.
- [x] Corregir la consulta de tasa 5xx para que no subestime errores cuando el tráfico es bajo; incorporar condición de tráfico mínimo.
- [x] Centralizar la política TLS de node-postgres para API, migraciones y validación de restauración.
- [x] Alinear `pg_dump`/`pg_restore` con TLS verificado cuando está habilitado y rechazar modos de downgrade.
- [x] Endurecer el rol runtime con `NOBYPASSRLS` y sin permiso `CREATE` en base/esquema; añadir aserciones PostgreSQL en CI.
- [ ] Confirmar CI del último commit y conservar su evidencia.
- [ ] Conectar un proveedor de métricas/logs, configurar alertas reales, retención, canales y responsables.
- [ ] Ejecutar simulacro de incidentes y restauración en staging con TLS/certificados del proveedor.
- [ ] Definir RPO/RTO, almacenamiento externo cifrado, programación y retención de backups.

**Límite:** runbook, pruebas unitarias e integración efímera no equivalen a observabilidad o recuperación productiva activa. No declarar producción lista sin completar los puntos externos.

## Principios

- Monolito modular en Node.js 22+ y Fastify.
- PostgreSQL estándar como persistencia; Supabase puede aportar PostgreSQL gestionado y autenticación.
- El dominio no depende del SDK de Supabase.
- Aislamiento multiempresa por workspace y autorización en el servidor.
- Evidencia comercial trazable: fuente, URL, fecha de observación y notas.
- Los análisis deben distinguir datos observados, inferencias y limitaciones; no inventar predicciones.

## Estado por módulo

### 1. Fundación técnica — completada

- [x] Servidor Fastify, configuración, health y readiness.
- [x] Pool PostgreSQL y migraciones SQL numeradas.
- [x] CI con pruebas y comprobación de sintaxis.
- [x] Integración de pruebas con PostgreSQL 16.

### 2. Identidad y acceso — backend implementado

- [x] Verificación de JWT de Supabase mediante JWKS (requiere `SUPABASE_URL` real); los tokens inválidos responden 401 y las caídas del proveedor JWKS responden 503, con prueba HTTP de regresión.
- [x] Usuarios, workspaces y membresías.
- [x] Auditoría atómica de creación de workspace y asignación del propietario inicial (`workspace.created` y `workspace_member.added`), con rollback probado ante fallo de auditoría.
- [x] Roles `owner`, `admin`, `analyst` y `viewer`.
- [x] Gestión de miembros, cambios de rol y restricciones de privilegios.
- [x] Invitaciones de un solo uso, hash SHA-256, expiración, revocación y auditoría.
- [x] Prueba PostgreSQL de aceptación concurrente: solo una solicitud puede consumir la invitación; prueba concurrente de aceptación contra revocación confirma que solo una transición puede completarse.
- [x] Revalidación de permisos dentro de la transacción tras bloquear el workspace; creación/revocación de invitaciones y cambios de miembros no confían únicamente en el rol leído por el pre-handler.
- [x] Orden de bloqueos uniforme para aceptación y revocación de invitaciones: workspace antes de invitación.
- [ ] Conectar un proyecto Supabase real y validar el flujo completo de Auth.
- [ ] Configurar políticas RLS y revisar permisos del proyecto.

### 3. Investigaciones — backend implementado

- [x] CRUD, validaciones, estados y aislamiento por workspace.
- [x] Auditoría transaccional de creación, actualización y archivo de investigaciones (`research.created`, `research.updated`, `research.archived`), con pruebas de rollback ante fallo de auditoría.

### 4. Inteligencia de mercado — backend implementado

- [x] Competidores y productos/servicios.
- [x] Observaciones y registros históricos de precios.
- [x] Relaciones multiempresa y validaciones de integridad.
- [ ] Automatizar captura de fuentes externas solo después de definir fuentes permitidas, límites y trazabilidad.

### 5. Análisis e informes — backend implementado

- [x] Análisis descriptivo a partir de registros disponibles.
- [x] Informes vinculados a investigación y workspace.
- [x] Snapshots versionados, historial y recuperación.
- [x] Huella SHA-256 y bloqueo de modificaciones de snapshots.
- [x] Exportación PDF y pruebas HTTP de autorización e integridad.
- [x] Calcular variación descriptiva entre los dos precios más recientes del mismo producto y moneda, exigiendo fechas distintas y evitando presentarla como predicción.\n- [ ] Ampliar análisis de oportunidades y riesgos con reglas explícitas, evidencia suficiente y validación de contexto.

### 6. Seguridad y operación — parcial

- [x] Autorización multiempresa en servidor.
- [x] Auditoría de operaciones relevantes en miembros, invitaciones, creación de workspaces e inteligencia de mercado.
- [x] Inmutabilidad de auditoría en PostgreSQL: bloquear UPDATE/DELETE/TRUNCATE y conservar eventos al eliminar workspace/actor mediante referencias SET NULL.
- [x] Completar auditoría atómica del CRUD de investigaciones y sus pruebas de rollback.
- [x] Pruebas de migraciones, relaciones, integridad, concurrencia y rutas HTTP de invitaciones.
- [x] Rate limiting por IP/ruta (120 solicitudes por 60 s por defecto; 10 para aceptar invitaciones), con límites configurables, cabeceras 429 y capacidad acotada; al llenarse, preserva ventanas activas y rechaza temporalmente nuevos buckets con 503 `RATE_LIMIT_CAPACITY`.
- [ ] Sustituir el almacenamiento en memoria por un backend compartido antes de escalar a múltiples instancias; el control de capacidad actual evita expulsar ventanas activas, pero no comparte contadores entre procesos.
- [ ] Ajustar la confianza en IP de cliente solo al configurar proxies de confianza.
- [x] Completar pruebas HTTP de gestión de miembros (listado, alta, cambio de rol, baja, protección del último owner y auditoría).
- [x] Métricas, correlación de trazas y logs estructurados, con pruebas automatizadas en CI; endpoint `/metrics` deshabilitado por defecto y habilitación explícita con `METRICS_ENABLED=true`.
- [x] Herramientas de backup custom-format y restauración protegida en base vacía; CI ejecuta backup real, restore real y verifica esquema/historial en PostgreSQL efímero.
- [x] Prueba de rollback de una migración fallida y conservación de migraciones previas.
- [ ] Programar backups externos cifrados, definir RPO/RTO y probar restauración periódica en el proveedor real.
- [x] Revisión estática documentada; pendiente cerrar los riesgos preproducción indicados en `docs/security/threat-model.md` y ejecutar pruebas externas antes del despliegue.

### 7. Producto y despliegue — pendiente

- [ ] Frontend responsive/PWA.
- [ ] Proveedor de correo transaccional para invitaciones.
- [ ] Proyecto Supabase real, Auth y RLS.
- [ ] Entorno de staging y despliegue productivo.
- [ ] Documentación operativa y pruebas de aceptación de usuario.

## Dependencias externas

Estos puntos requieren cuentas, credenciales, configuración o decisiones del propietario del proyecto. No se deben simular ni marcar como terminados hasta verificarlos:
- Proyecto Supabase y sus claves/configuración.
- Dominio, hosting y base de datos administrada, si se decide usarlos.
- Proveedor de correo y dominio remitente.
- Decisiones finales de interfaz, marca y experiencia de usuario.

## Regla de entrega

Los cambios se desarrollan en `backend/foundation`, se prueban en CI y se mantienen en el PR draft. No fusionar a `main` ni afirmar que existe un servicio externo conectado sin una verificación real.


### Seguridad de PostgreSQL
- [x] Separar credenciales `DATABASE_URL` (runtime) y `MIGRATION_DATABASE_URL` (migraciones); exigir esta última en producción.
- [x] Crear bootstrap de roles `radar_runtime` y `radar_migration_owner` con privilegio mínimo para una base nueva.
- [x] Aplicar grants de runtime después de migrar: DML operativo, INSERT únicamente en auditoría, sin acceso a `schema_migrations` ni CREATE en `public`.
- [x] Añadir pruebas de resolución de credenciales y privilegios PostgreSQL; CI ejecuta aprovisionamiento y migraciones usando el rol propietario dedicado.
- [ ] Ejecutar el procedimiento con el proveedor PostgreSQL real, validar TLS/red/propietarios y probar restauración; aún no hay infraestructura productiva conectada.


### Recuperación PostgreSQL
- [x] `npm run db:backup`: pg_dump custom-format, no sobrescribe archivos y verifica legibilidad con pg_restore.
- [x] `npm run db:restore`: exige confirmación exacta, rol/propietario migrador y base destino vacía; restauración atómica sin `--clean`.
- [x] CI valida copia/restauración real en una segunda base PostgreSQL y reaplica permisos runtime.
- [x] Prueba de integración demuestra rollback de la migración fallida y conservación de la migración previa confirmada.
- [ ] Configurar almacenamiento externo cifrado, programación/retención, alertas, RPO/RTO y recuperación PITR según proveedor.


### Aislamiento multi-tenant y autorización transaccional
- [x] Revisión de rutas HTTP de investigación, competidores, productos, observaciones, precios, análisis, informes, PDF y auditoría.
- [x] Consultas de lectura y relaciones PostgreSQL limitadas por `workspace_id`; claves foráneas compuestas impiden asociar productos, observaciones e informes con recursos de otro workspace.
- [x] Revalidar dentro de la transacción el usuario activo, la membresía actual y el rol antes de cada mutación de investigación/inteligencia comercial y antes de crear snapshots.
- [x] Bloqueo consistente workspace → membresía, alineado con revocación/cambio de miembros para cerrar la carrera TOCTOU.
- [x] Pruebas unitarias de membresía revocada/degradada y prueba PostgreSQL de que una membresía retirada no puede insertar ni auditar recursos.
- [ ] Evaluar RLS únicamente si se habilita acceso directo de clientes a PostgreSQL; actualmente la API es la frontera de autorización.


### Integridad de snapshots de informes
- [x] Impedir UPDATE y DELETE directos de snapshots; permitir únicamente la eliminación en cascada derivada del ciclo de vida de la investigación/workspace.
- [x] Prueba de integración PostgreSQL para borrado directo rechazado y cascada del recurso padre.


### Historial de auditoría
- [x] Bloquear la lectura frente a revocaciones simultáneas mediante revalidación transaccional y bloqueo workspace → membresía.
- [x] Incorporar paginación keyset estable por `(created_at,id)`, límite 50 por defecto / 100 máximo y cursor opaco validado.
- [x] Documentar el endpoint owner/admin en OpenAPI y modelo de amenazas.
- [x] Añadir pruebas unitarias, HTTP y PostgreSQL para permisos actuales, cursores y recorrido de páginas.


### Verificación de integridad de respaldos

- [x] Generar manifiesto lateral versionado con SHA-256 y tamaño del archivo.
- [x] Verificar digest y tamaño antes de restaurar; rechazar manifiestos ausentes o malformados.
- [x] Copiar y verificar el respaldo dentro de un directorio temporal privado y restaurar exclusivamente desde esa copia para cerrar la ventana TOCTOU del archivo de origen.
- [x] Rechazar enlaces simbólicos tanto en el respaldo como en su manifiesto y limpiar la copia temporal ante éxito o error.
- [x] Añadir pruebas para corrupción, manifiestos inválidos, permisos de staging y sustitución posterior del archivo de origen.
- [ ] Confirmar una ejecución CI exitosa sobre el head final del PR; la validación anterior no cubre los últimos commits.
- [ ] Para autenticidad frente a un atacante con capacidad de reemplazar respaldo y manifiesto, definir firma digital/HMAC y gestión separada de claves. SHA-256 por sí solo detecta corrupción accidental, no autentica el origen.


### Exportación verificable del historial de auditoría

- [x] Endpoint owner/admin `GET /api/v1/workspaces/{workspaceId}/audit-logs/export` con paginación keyset y máximo 100 eventos por página.
- [x] NDJSON con serialización determinista y SHA-256 del cuerpo exacto en cabecera de respuesta.
- [x] Contador de eventos y cursor de continuación para completar exportaciones sin respuestas ilimitadas.
- [x] Reutilizar la revalidación transaccional y bloqueos workspace → membresía antes de leer auditoría.
- [x] Documentar contrato OpenAPI, matriz de roles y límites de seguridad.
- [x] Confirmar CI exitosa para el último head del PR: CI #766 aprobada con 256 pruebas, 0 fallidas.
- [ ] Definir destino externo inmutable/cifrado, retención y firma digital o HMAC con gestión separada de claves si se requiere autenticidad verificable frente a un atacante.
