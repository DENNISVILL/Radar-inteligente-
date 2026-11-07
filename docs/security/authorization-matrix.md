# Matriz de autorización HTTP

Estado: contrato de cobertura para completar la suite. La existencia de esta matriz no significa que todos sus casos estén probados.

## Roles

- owner: propietario del workspace.
- admin: administración del workspace según las reglas del dominio.
- analyst: trabajo con investigaciones y datos comerciales.
- viewer: lectura.
- no miembro: identidad autenticada sin membresía en el workspace.
- anónimo: sin credenciales válidas.

## Matriz objetivo

| Recurso/operación | Owner | Admin | Analyst | Viewer | No miembro |
|---|---|---|---|---|---|
| Perfil propio y workspaces propios | Sí | Sí | Sí | Sí | Solo perfil/workspaces propios |
| Leer miembros | Sí | Sí | Según política | No | No |
| Administrar miembros | Sí, sujeto a invariantes | Sí, sujeto a invariantes | No | No | No |
| Administrar invitaciones | Sí | Según política | No | No | No |
| Leer investigaciones | Sí | Sí | Sí | Sí | No |
| Crear/editar/eliminar investigaciones | Sí | Sí | Sí | No | No |
| Leer competidores, productos, precios y observaciones | Sí | Sí | Sí | Sí | No |
| Mutar competidores, productos, precios y observaciones | Sí | Sí | Sí | No | No |
| Generar/leer informes | Sí | Sí | Sí | Sí | No |
| Guardar snapshots | Sí | Sí | Sí | No | No |
| Exportar PDF de snapshot autorizado | Sí | Sí | Sí | Según política de lectura | No |
| Consultar auditoría | Sí | Según política | No | No | No |

La política efectiva de cada endpoint debe coincidir con las reglas de negocio implementadas. Si difiere, documentar la excepción explícitamente y probarla.

## Casos negativos obligatorios por familia de rutas

1. Sin token y con token inválido/expirado: 401; no ejecutar lógica de negocio.
2. Usuario autenticado sin membresía: 403 o 404 de forma consistente.
3. Usuario de workspace A consulta IDs de workspace B: nunca revelar datos de B.
4. Viewer intenta mutar: 403 y ninguna escritura.
5. Analyst intenta administrar miembros o leer auditoría restringida: 403.
6. UUID malformado: 400 antes de consultar PostgreSQL.
7. Recurso inexistente dentro del workspace autorizado: 404.
8. Referencias entre recursos de workspaces distintos: rechazar sin mutación.
9. Fallo de integridad de snapshot: no emitir PDF.
10. Operación denegada: no crear eventos de auditoría que indiquen éxito.
11. Operaciones concurrentes de membresía: preservar unicidad y último owner.
12. Invitación: token vigente, no revocado, de un solo uso y correo autenticado verificado coincidente.

## Evidencia requerida

Cada prueba debe comprobar método/ruta, rol, workspace de sesión, workspace objetivo, código HTTP, ausencia de escrituras ante denegación y evento de auditoría cuando corresponda. Ejecutar contra PostgreSQL real de CI, no únicamente con mocks.

## Criterio de cierre

La matriz queda cubierta cuando cada endpoint de negocio tiene pruebas positivas y negativas para los roles aplicables, aislamiento entre dos workspaces, sesión anónima, UUID inválido y referencias cruzadas. Los controles que dependen de Supabase Auth real deben quedar identificados como integración pendiente y no declararse validados en producción.
