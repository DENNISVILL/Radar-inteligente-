# Plan de implementación del backend
## Principios
- Monolito modular en Node.js 20+ y Fastify.
- PostgreSQL estándar; Supabase se incorpora como PostgreSQL gestionado y proveedor de identidad.
- El dominio no depende del SDK de Supabase.
- Aislamiento multiempresa por workspace y autorización en servidor.
- No exponer rutas de negocio sin autenticación y autorización.
## Fases
1. Fundación: servidor, configuración, health/readiness, PostgreSQL, migraciones y CI.
2. Identidad y acceso: validación de JWT, usuarios, membresías y roles.
3. Investigaciones: CRUD persistente, filtros, paginación y auditoría.
4. Fuentes y observaciones: URL, fecha, evidencia y verificación.
5. Competidores, productos, servicios, precios e historial.
6. Tendencias, análisis, oportunidades y riesgos.
7. Informes, versiones y exportación.
8. Seguridad, límites, observabilidad y documentación operativa.
## Estado
- [x] Servidor Fastify y health/readiness.
- [x] Pool PostgreSQL configurable y migración inicial.
- [x] Verificación de JWT de Supabase mediante JWKS (requiere SUPABASE_URL).
- [x] Endpoint de identidad actual y consulta de acceso a workspace.
- [x] Pruebas unitarias de autorización y extracción Bearer.
- [ ] Aprovisionamiento/sincronización de usuarios tras validar JWT.
- [ ] Alta y gestión de workspaces y membresías.
- [ ] CRUD completo de investigaciones.
- [ ] Resto de módulos funcionales.
## Nota operativa
El endpoint /api/v1/me devuelve los claims mínimos verificados. La comprobación de acceso consulta la membresía activa en PostgreSQL. El registro/login y el alta de usuarios se administrarán con Supabase Auth al configurar el proyecto; la API no acepta identidad enviada por el cliente como sustituto de un JWT verificado.
