# Plan de implementación del frontend — Radar Comercial

## Alcance y criterio de avance

El backend tiene **29/29 entregables principales completados (100 %)**. El frontend tiene **16/16 tareas principales implementadas y validadas por CI (100 %)**. Son métricas separadas: ninguna equivale por sí sola a despliegue productivo.

El frontend vive en `apps/web` y utiliza Next.js App Router, React y TypeScript. Consume el contrato HTTP documentado en `docs/api/openapi.yaml` mediante la API Fastify. La API conserva la autoridad de autenticación/autorización multiempresa; el navegador no accede directamente a PostgreSQL.

Identidad visual: profesional, analítica y clara; azul profundo, turquesa, grises y fondos claros.

## Las 16 tareas principales

| N.º | Tarea | Alcance implementado | Estado |
|---:|---|---|---|
| 1 | Estructura técnica | Next.js, TypeScript, configuración, carpetas modulares, entorno y CI | Completada y validada |
| 2 | Sistema visual y componentes | Tokens, tipografía, colores, componentes, estados y navegación | Completada y validada |
| 3 | Landing pública | Presentación, propuesta de valor, capacidades y acceso | Completada y validada |
| 4 | Autenticación y acceso | Login, registro, recuperación, confirmación y actualización de contraseña | Código y CI completados; Supabase real pendiente |
| 5 | Dashboard principal | Resumen, actividad, investigaciones recientes, métricas y navegación privada | Completada y validada |
| 6 | Workspaces y administración | Espacios, miembros, roles, invitaciones y preferencias | Completada y validada |
| 7 | Crear investigación | Formulario de investigación, ubicación, sector, objetivo y validaciones | Completada y validada |
| 8 | Centro de investigación | Listado, filtros, detalle, estados, observaciones y seguimiento | Completada y validada |
| 9 | Competidores | Registro, búsqueda, edición, archivo y comparación | Completada y validada |
| 10 | Productos y precios | Catálogo, asociación con competidores, registro e historial de precios | Completada y validada |
| 11 | Tendencias | Vista descriptiva de tendencias con los datos disponibles | Completada y validada |
| 12 | Oportunidades y riesgos | Registro, filtros, confianza y evidencia asociada | Completada y validada |
| 13 | Fuentes y evidencias | Registro centralizado desde observaciones y precios, búsqueda, filtros y enlaces | Completada y validada |
| 14 | Informes y PDF | Vista previa, snapshots inmutables, historial, integridad y descarga PDF | Completada y validada |
| 15 | Historial, perfil y auditoría | Historial y consulta de registros disponibles según permisos | Completada y validada |
| 16 | Integración y aceptación técnica | Navegación entre módulos, comprobaciones de frontend y backend, CI integral | Completada y validada |

## Evidencia de validación

Las ejecuciones integrales recientes reportaron ambos jobs exitosos:

- Tarea 12, oportunidades y riesgos: [CI 42567603889](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42567603889).
- Tarea 13, fuentes y evidencias: [CI 42568414767](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42568414767).
- Tarea 14, informes y PDF: [CI 42568707876](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42568707876).
- Tarea 15, historial y auditoría: [CI 42568900619](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42568900619).
- Integración de tarea 16: [CI 42569255825](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42569255825).
- Revalidación de rama: [CI 42569409465](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42569409465) y [CI 42569404926](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42569404926).

Los jobs revisados incluyen frontend TypeScript/compilación de producción y backend/PostgreSQL. La CI no sustituye pruebas de aceptación con credenciales, datos y servicios reales.

## Reglas técnicas y de seguridad

- Mantener módulos independientes; evitar concentrar la aplicación en archivos monolíticos.
- Tipar peticiones y respuestas con el contrato OpenAPI existente.
- Enviar el token vigente como Bearer a la API.
- No exponer claves service-role, secretos de servidor ni credenciales PostgreSQL al cliente.
- No duplicar en frontend las reglas de autorización del backend. La API valida permisos por workspace y rol.
- Mostrar estados de carga, vacío, error y falta de permisos.
- Mantener navegación responsive y controles accesibles por teclado.
- No presentar servicios externos como conectados si no han sido configurados y probados.
- No inventar endpoints ni datos de negocio para completar pantallas.

## Dependencias y pendientes antes de producción

La implementación frontend y la CI están completas, pero quedan pasos de integración/operación externa:

1. Crear/configurar el proyecto Supabase real y verificar URL, clave publicable, redirect URLs, plantillas de correo y flujos de sesión.
2. Configurar proveedor de correo transaccional para invitaciones.
3. Configurar hosting, dominio, TLS y variables de entorno de staging/producción.
4. Ejecutar pruebas de aceptación con roles owner/admin/analyst/viewer y más de un workspace.
5. Probar creación y edición de investigaciones, competidores, productos, precios, observaciones, informes y descarga PDF con datos reales.
6. Probar responsive en teléfonos y tabletas, accesibilidad y comportamiento ante errores/redes lentas.
7. Revisar logs, backups, restauración, monitoreo, límites de uso y política de privacidad antes de abrir el servicio a usuarios.

**Estado final:** backend 29/29 (100 %); frontend 16/16 (100 %). El producto todavía no debe anunciarse como desplegado ni listo para producción hasta completar los pasos externos y la aceptación real.
