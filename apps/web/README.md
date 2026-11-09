# Frontend de Radar Comercial

Aplicación web Next.js App Router + React + TypeScript.

## Configuración local

1. Copia `.env.example` a `.env.local` dentro de `apps/web`.
2. Comprueba que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` correspondan al proyecto Supabase autorizado.
3. Configura en Supabase Auth → URL Configuration la URL local `http://localhost:3001` y permite como redirect URL `http://localhost:3001/auth/confirm`.
4. Para producción, agrega el dominio definitivo a Site URL y Redirect URLs cuando exista.

La publishable key está diseñada para ser pública. Nunca uses una `service_role`, secret key ni credenciales de PostgreSQL en el navegador o en archivos versionados. Las tablas expuestas deben tener RLS y políticas explícitas.

## Comandos

- `npm install`
- `npm run dev` (puerto 3001)
- `npm run check`
- `npm run build`

## Organización

- `src/app`: rutas, layouts y estilos globales.
- `src/modules`: funcionalidades organizadas por dominio.
- `src/components`: componentes visuales compartidos.
- `src/lib/supabase`: clientes Supabase para navegador y servidor.
- `proxy.ts`: renovación de sesiones Supabase mediante cookies en Next.js 16.
- `src/services`: servicios de aplicación.
- `src/shared`: tipos y utilidades compartidas.
- `tests`: pruebas del frontend.

La autenticación utiliza Supabase Auth. La API Fastify sigue siendo la autoridad para validar identidad, roles y permisos multiempresa; el navegador no accede directamente a PostgreSQL. La integración no se considera validada hasta completar pruebas con el proyecto real.
