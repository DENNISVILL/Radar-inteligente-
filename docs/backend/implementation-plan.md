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
- [x] Completar auditoría atómica del CRUD de investigaciones y sus pruebas de rollback.
- [x] Pruebas de migraciones, relaciones, integridad, concurrencia y rutas HTTP de invitaciones.
- [x] Rate limiting por IP/ruta (120 solicitudes por 60 s por defecto; 10 para aceptar invitaciones), con límites configurables, cabeceras 429 y capacidad acotada; al llenarse, preserva ventanas activas y rechaza temporalmente nuevos buckets con 503 `RATE_LIMIT_CAPACITY`.
- [ ] Sustituir el almacenamiento en memoria por un backend compartido antes de escalar a múltiples instancias; el control de capacidad actual evita expulsar ventanas activas, pero no comparte contadores entre procesos.
- [ ] Ajustar la confianza en IP de cliente solo al configurar proxies de confianza.
- [x] Completar pruebas HTTP de gestión de miembros (listado, alta, cambio de rol, baja, protección del último owner y auditoría).
- [x] Métricas, correlación de trazas y logs estructurados, con pruebas automatizadas en CI; endpoint `/metrics` deshabilitado por defecto y habilitación explícita con `METRICS_ENABLED=true`.
- [ ] Alertas operativas, copias de seguridad y restauración probada.
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
