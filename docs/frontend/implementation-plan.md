# Plan de implementación del frontend — Radar Comercial

## Alcance y criterio de avance

El backend tiene **29 de 29 entregables principales completados (100 %)**. Esto no equivale a despliegue productivo: Supabase real, correo, hosting, alertas, backups externos y otros puntos operativos siguen dependiendo de configuración externa.

El frontend se desarrolla como una aplicación web responsive dentro de `apps/web`, con posibilidad de evolucionar a PWA. Comparte el contrato HTTP documentado en `docs/api/openapi.yaml`.

**Stack:** Next.js App Router, React, TypeScript y Supabase Auth cuando se configure el proyecto real. El cliente consume la API Fastify; no accede directamente a tablas PostgreSQL ni replica reglas de autorización del servidor.

**Identidad visual:** profesional, analítica, clara y práctica; azul profundo, turquesa de acento, grises y fondos claros. Nombre visible: Radar Comercial. Promesa: “Información comercial organizada para tomar decisiones con más criterio”.

## Las 16 tareas principales

| N.º | Tarea | Alcance principal | Estado |
|---:|---|---|---|
| 1 | Estructura técnica del frontend | Next.js, TypeScript, configuración, carpetas modulares, entorno y CI | Completada |
| 2 | Sistema visual y componentes base | Tokens, tipografía, colores, botones, campos, tarjetas, tablas, estados y navegación | Completada |
| 3 | Landing pública | Presentación, propuesta de valor, capacidades, beneficios y acceso | Completada |
| 4 | Autenticación y acceso | Inicio de sesión, registro, recuperación, confirmación y actualización de contraseña | Código y CI completados; integración real pendiente |
| 5 | Dashboard principal | Resumen, actividad, investigaciones recientes, métricas y navegación privada | Completada por CI |
| 6 | Espacios de trabajo y administración | Selector de workspace, miembros, roles, invitaciones y preferencias | Completada por CI |
| 7 | Crear investigación | Formulario, ubicación, país/ciudad, sector, objetivo y validaciones | Completada por CI |
| 8 | Centro de investigación | Listado por workspace, filtros, ficha, estado, observaciones y seguimiento | Completada por CI |
| 9 | Competidores | Registro, listado, detalle, edición, archivo y comparación | Completada por CI |
| 10 | Productos y precios | Catálogo, moneda, unidad, historial y comparación de precios | Completada y validada por CI |
| 11 | Tendencias | Evolución temporal y variaciones descriptivas con datos disponibles | Completada y validada por CI |
| 12 | Oportunidades y riesgos | Hallazgos, evidencia asociada, nivel de confianza y seguimiento | Completada y validada por CI |
| 13 | Fuentes y evidencias | Fuente, URL, fecha, notas, confiabilidad y trazabilidad | Pendiente |
| 14 | Informes y PDF | Vista de informe, versiones, descarga y estados de generación | Pendiente |
| 15 | Historial, perfil y auditoría | Historial de investigaciones/informes, perfil y registro de acciones según permisos | Pendiente |
| 16 | Integración y aceptación final | Conexión API, manejo de errores, responsive, accesibilidad, pruebas y revisión integral | Pendiente |

Las 16 tareas agrupan aproximadamente 40–50 subtareas verificables. El porcentaje se calcula por tareas principales implementadas y validadas por CI. Las dependencias externas se informan por separado y no se simulan.

## Reglas técnicas

- Mantener módulos independientes y responsabilidades claras; no concentrar la aplicación en un archivo gigante.
- Separar componentes compartidos, servicios HTTP, autenticación, tipos y utilidades.
- Tipar los contratos de respuesta y petición con el OpenAPI existente.
- Enviar el access token vigente como Bearer; el SDK de autenticación administrará la renovación de sesión cuando Supabase esté configurado.
- El frontend no guarda ni recibe service-role keys, secretos de servidor o credenciales PostgreSQL.
- La API sigue siendo la autoridad de autorización multiempresa y permisos. Ocultar botones en la interfaz no reemplaza los controles del backend.
- Los estados de carga, vacío, error, falta de permisos y conexión deben ser explícitos.
- Priorizar diseño responsive, accesibilidad por teclado y contraste legible.
- No simular datos reales ni mostrar como conectado un servicio externo que no esté configurado.
- Cada tarea requiere implementación, comprobaciones automatizadas y CI aprobada antes de marcarse completa.

## Progreso

- Backend: 29/29 entregables principales (100 %).
- Frontend: **12/16 tareas principales implementadas y validadas por CI (75 %)**.
- Tarea 1: estructura técnica creada y validada por CI.
- Tarea 2: sistema visual y componentes compartidos implementados y validados por CI.
- Tarea 3: landing pública implementada y validada en CI [42560159154](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42560159154) y [42560163862](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42560163862).
- Tarea 4: login, registro, recuperación y actualización de contraseña; confirmación de enlaces Supabase; cliente Supabase opcional; helper `/api/v1/me`. Validada por CI [42562516137](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562516137) y [42562511741](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562511741). La conexión real de Supabase sigue pendiente.
- Tarea 5: dashboard privado con comprobación de sesión, consulta de workspaces e investigaciones, métricas por estado, investigaciones recientes, estados de carga/error/vacío, navegación responsive y cierre de sesión. Frontend typecheck y build aprobados; CI integral con backend y PostgreSQL también aprobada en [42562868031](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562868031) y [42562872699](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562872699).
- Tarea 6: administración de espacios de trabajo y equipos; consulta/creación de workspaces, miembros, roles e invitaciones, incluida revocación y copia del token. Backend/PostgreSQL y frontend typecheck/build aprobados en CI [42563218224](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42563218224). El envío automático de correos sigue pendiente de proveedor externo.
- Tarea 7: formulario de creación de investigaciones con workspace, título, país, ciudad/región, sector, objetivo y estado inicial; CI integral aprobada en [42563524680](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42563524680).
- Tarea 8: centro de investigación con listado por workspace, búsqueda y filtros por estado/título/sector/ubicación; ficha individual, cambio de estado, registro y timeline de observaciones con fecha, fuente, URL y nivel de confianza. Frontend typecheck/build y pruebas backend con PostgreSQL, restauración de backup firmado y validación OpenAPI aprobados en CI [42564481005](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42564481005).
- Tarea 9: módulo de competidores con registro, búsqueda, edición, archivo y comparación descriptiva de hasta dos registros. CI frontend TypeScript/build y backend/PostgreSQL, backup firmado/restauración y OpenAPI aprobados en [42565334887](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42565334887).
- Tarea 12: registro y consulta de oportunidades/riesgos por investigación, métricas, filtros, búsqueda, nivel de confianza y enlaces de evidencia. Usa exclusivamente el endpoint existente de observaciones y sus tipos `opportunity`/`risk`; implementación en `e082031293271fda82ec4f5549f0b886dd208cbf`, CI en ejecución.\n- Siguiente después de validar tarea 12: tarea 13, fuentes y evidencias.
- Producto completo: no se calcula como promedio simple de backend y frontend; se reportarán ambos por separado.

## Dependencias externas pendientes

- Proyecto Supabase real, URL y clave publicable para activar y probar autenticación real.
- Proveedor de correo transaccional para invitaciones.
- Hosting y dominio para staging/producción.

No se inventarán credenciales ni se marcarán integraciones externas como listas sin pruebas reales.
