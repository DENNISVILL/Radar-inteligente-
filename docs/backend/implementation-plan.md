# Plan de implementación del backend
## Principios
- Monolito modular en Node.js 20+ y Fastify.
- PostgreSQL estándar; Supabase se incorporará después como PostgreSQL gestionado y proveedor de autenticación.
- El dominio no dependerá de SDKs de Supabase.
- Aislamiento multiempresa por workspace y autorización en servidor.
- No exponer rutas de negocio antes de implementar autenticación y autorización.
## Fases
1. Fundación: servidor, configuración, logging, health/readiness, PostgreSQL, migraciones y CI.
2. Identidad: usuarios, sesiones, membresías, roles y autorización.
3. Investigaciones: CRUD persistente, filtros, paginación y auditoría.
4. Fuentes y observaciones: URL, fecha, evidencia y verificación.
5. Competidores, productos, servicios, precios e historial.
6. Tendencias, análisis, oportunidades y riesgos.
7. Informes, versiones y exportación.
8. Seguridad, límites, observabilidad y documentación operativa.
## Supabase
La aplicación usa PostgreSQL estándar mediante pg y migraciones SQL versionadas. La conexión a Supabase se realizará configurando la URL PostgreSQL y validando JWT de Supabase Auth en la fase de identidad. No se duplicará el esquema ni se moverán reglas de negocio a Edge Functions sin necesidad.
## Estado
- [x] Servidor Fastify y health/readiness.
- [x] Pool PostgreSQL configurable.
- [x] Esquema inicial multiempresa e investigaciones.
- [x] Migración SQL inicial y script de aplicación.
- [ ] Autenticación y autorización.
- [ ] CRUD completo de investigaciones.
- [ ] Resto de módulos funcionales.
