# Plan de implementación del frontend — Radar Comercial

## Alcance y criterio de avance

El backend tiene **29 de 29 entregables principales completados (100 %)**. Esto no equivale a despliegue productivo: Supabase real, correo, hosting, alertas, backups externos y otros puntos operativos siguen dependiendo de configuración externa.

El frontend se desarrolla como una aplicación web responsive con posibilidad de evolucionar a PWA. Se mantiene separado del backend dentro de `apps/web`, pero comparte el contrato HTTP documentado en `docs/api/openapi.yaml`.

**Stack acordado:** Next.js App Router, React, TypeScript y Supabase Auth cuando se configure el proyecto real. El cliente consumirá la API Fastify; no accederá directamente a tablas PostgreSQL ni replicará reglas de autorización del servidor.

**Identidad visual acordada:** profesional, analítica, clara y práctica; azul profundo, turquesa de acento, grises y fondos claros. Nombre visible: Radar Comercial. Promesa: “Información comercial organizada para tomar decisiones con más criterio”.

## Las 16 tareas principales

| N.º | Tarea | Alcance principal | Estado |
|---:|---|---|---|
| 1 | Estructura técnica del frontend | Next.js, TypeScript, configuración, carpetas modulares, entorno y CI | Completada |
| 2 | Sistema visual y componentes base | Tokens, tipografía, colores, botones, campos, tarjetas, tablas, estados y navegación | Completada |
| 3 | Landing pública | Presentación, propuesta de valor, capacidades, beneficios y acceso | Completada |
| 4 | Autenticación y acceso | Inicio de sesión, registro, recuperación, confirmación y actualización de contraseña | Implementada y validada por CI; integración real pendiente |
| 5 | Dashboard principal | Resumen, actividad, investigaciones recientes y accesos rápidos | En desarrollo |
| 6 | Espacios de trabajo y administración | Selector de workspace, miembros, roles, invitaciones y preferencias | Pendiente |
| 7 | Crear investigación | Formulario, ubicación, país/ciudad, sector, objetivo y validaciones | Pendiente |
| 8 | Centro de investigación | Detalle, estado, observaciones, seguimiento y navegación por investigación | Pendiente |
| 9 | Competidores | Registro, listado, detalle, edición, archivo y comparación | Pendiente |
| 10 | Productos y precios | Catálogo, moneda, unidad, historial y comparación de precios | Pendiente |
| 11 | Tendencias | Evolución temporal y variaciones descriptivas con datos disponibles | Pendiente |
| 12 | Oportunidades y riesgos | Hallazgos, evidencia asociada, nivel de confianza y seguimiento | Pendiente |
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
- Frontend: **4/16 tareas principales implementadas y validadas por CI (25 %)**.
- Tarea 1: estructura técnica creada y validada por CI.
- Tarea 2: sistema visual y componentes compartidos implementados y validados por CI.
- Tarea 3: landing pública implementada y validada en CI [42560159154](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42560159154) y [42560163862](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42560163862).
- Tarea 4: formularios de inicio de sesión, registro, recuperación y actualización de contraseña; confirmación de enlaces Supabase; cliente Supabase opcional según configuración; helper para consultar `/api/v1/me` con Bearer. Validada por CI [42562516137](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562516137) y [42562511741](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42562511741).
- Tarea 4 no se ha probado contra un proyecto Supabase real: la integración externa continúa pendiente.
- Producto completo: no se calcula como promedio simple de backend y frontend; se reportarán ambos por separado.

## Dependencias externas pendientes

- Proyecto Supabase real, URL y clave publicable para activar y probar autenticación real.
- Proveedor de correo transaccional para invitaciones.
- Hosting y dominio para staging/producción.

No se inventarán credenciales ni se marcarán integraciones externas como listas sin pruebas reales.
