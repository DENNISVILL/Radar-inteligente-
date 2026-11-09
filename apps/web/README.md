# Frontend de Radar Comercial

Aplicación web Next.js App Router + React + TypeScript.

## Comandos
- `npm install`
- `npm run dev` (puerto 3001)
- `npm run check`
- `npm run build`

## Organización
- `src/app`: rutas, layouts y estilos globales.
- `src/modules`: funcionalidades organizadas por dominio.
- `src/components`: componentes visuales compartidos.
- `src/services`: clientes de API y autenticación.
- `src/shared`: tipos y utilidades compartidas.
- `tests`: pruebas del frontend.

No se conecta a Supabase hasta que el proyecto real esté configurado. No incluir secretos en variables `NEXT_PUBLIC_*`.
