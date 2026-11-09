# Radar Comercial

Plataforma de investigación e inteligencia comercial para organizar evidencia, comparar competidores y generar informes trazables.

## Estado del proyecto

- **Backend:** 29/29 entregables principales completados (100 %), con pruebas automatizadas, PostgreSQL en CI, contrato OpenAPI, exportación PDF, auditoría, rate limiting y controles de operación.
- **Frontend:** 16/16 tareas principales implementadas y validadas por CI (100 %), incluida la integración de navegación entre módulos. La validación automatizada no equivale a despliegue productivo ni sustituye pruebas de aceptación con usuarios reales.
- **Autenticación externa:** los flujos de autenticación pasaron CI, pero falta conectar y probar un proyecto Supabase real y el proveedor de correo.
- **Producción:** todavía no está listo para producción. No hay proyecto Supabase real, proveedor de correo, hosting ni despliegue productivo conectados.

## Producto y experiencia

Radar Comercial está dirigido a emprendedores y pequeñas empresas. Su identidad es profesional, analítica, clara y práctica, con azul profundo, turquesa de acento, grises y fondos claros.

Promesa: “Información comercial organizada para tomar decisiones con más criterio”.

## Arquitectura

- `src/`: backend Fastify y módulos del servidor.
- `apps/web/`: frontend Next.js App Router + React + TypeScript.
- `docs/api/openapi.yaml`: contrato HTTP compartido.
- `docs/frontend/implementation-plan.md`: plan de 16 tareas del frontend y progreso.
- `docs/backend/implementation-plan.md`: entregables y límites del backend.

El frontend consume la API Fastify mediante HTTP. No accede directamente a PostgreSQL. Supabase Auth se integrará cuando exista un proyecto real configurado.

## Backend: desarrollo local

Consulta las instrucciones y variables de entorno en `.env.example`. Comandos principales: `npm install`, `npm test`, `npm run check`, `npm run db:migrate`.

## Frontend: desarrollo local

1. Instala Node.js 22 o superior.
2. Entra en `apps/web`.
3. Copia `.env.example` a `.env.local` y ajusta la URL de API cuando el backend esté disponible.
4. Ejecuta `npm install`.
5. Ejecuta `npm run dev` y abre `http://localhost:3001`.

Comprobaciones: `npm run check` y `npm run build`.

## Seguridad

- Nunca subas archivos `.env`, contraseñas, claves privadas, tokens ni claves service-role.
- La API es la autoridad de autorización por workspace y rol.
- La clave publicable de Supabase puede exponerse al cliente solo cuando se configure el proyecto; las claves privilegiadas nunca.
- La presencia de un frontend no significa que exista una integración real ni un despliegue productivo.

Consulta los planes en `docs/backend/implementation-plan.md` y `docs/frontend/implementation-plan.md`.
