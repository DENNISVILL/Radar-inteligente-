# Radar Comercial
Plataforma de investigación e inteligencia comercial con fuentes verificables.
## Estado
Implementación del backend. Esta rama incorpora la fundación del servidor y el esquema inicial PostgreSQL. No es todavía una plataforma lista para producción.
## Stack
- Node.js 20+
- Fastify 5
- PostgreSQL mediante pg
- Node.js Test Runner y GitHub Actions
## Desarrollo local
1. Instala Node.js 20+ y PostgreSQL.
2. Copia .env.example a .env y configura DATABASE_URL.
3. Ejecuta npm install.
4. Ejecuta npm run db:migrate.
5. Inicia con npm run dev.
Rutas: GET /health (proceso) y GET /ready (PostgreSQL).
Comandos: npm test, npm run check, npm start.
## Seguridad y arquitectura
Monolito modular. Las rutas de negocio no se expondrán hasta implementar autenticación y autorización multiempresa. Nunca subir .env ni credenciales.
La conexión posterior con Supabase usará PostgreSQL estándar y Supabase Auth; las reglas del negocio no dependerán del SDK.
Consulta docs/backend/implementation-plan.md para las fases.
