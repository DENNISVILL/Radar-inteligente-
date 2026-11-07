# Plan de implementación de Radar Comercial

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

- [x] Verificación de JWT de Supabase mediante JWKS (requiere `SUPABASE_URL` real).
- [x] Usuarios, workspaces y membresías.
- [x] Roles `owner`, `admin`, `analyst` y `viewer`.
- [x] Gestión de miembros, cambios de rol y restricciones de privilegios.
- [x] Invitaciones de un solo uso, hash SHA-256, expiración, revocación y auditoría.
- [x] Prueba PostgreSQL de aceptación concurrente: solo una solicitud puede consumir la invitación.
- [ ] Conectar un proyecto Supabase real y validar el flujo completo de Auth.
- [ ] Configurar políticas RLS y revisar permisos del proyecto.

### 3. Investigaciones — backend implementado

- [x] CRUD, validaciones, estados y aislamiento por workspace.

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
- [ ] Ampliar análisis de tendencias, oportunidades y riesgos con reglas explícitas y evidencia suficiente.

### 6. Seguridad y operación — parcial

- [x] Autorización multiempresa en servidor.
- [x] Auditoría de operaciones relevantes.
- [x] Pruebas de migraciones, relaciones, integridad, concurrencia y rutas HTTP de invitaciones.
- [x] Rate limiting fijo por IP y ruta (120 solicitudes por 60 s por defecto; 10 para aceptar invitaciones), con límites configurables, cabeceras y respuesta 429.
- [ ] Sustituir el almacenamiento en memoria por un backend compartido antes de escalar a múltiples instancias.
- [ ] Ajustar la confianza en IP de cliente solo al configurar proxies de confianza.
- [ ] Completar pruebas HTTP de gestión de miembros.
- [ ] Observabilidad, alertas, copias de seguridad y restauración probada.
- [ ] Revisión de seguridad antes de producción.

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
