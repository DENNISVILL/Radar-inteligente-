# Matriz de autorización HTTP

Estado: matriz de referencia contrastada con pruebas HTTP unitarias y una suite de integración PostgreSQL. La cobertura es amplia, pero no implica que cada combinación posible de ruta, método, rol y estado se haya probado exhaustivamente.

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

La evidencia actual incluye pruebas HTTP por familias de rutas (workspaces, miembros, invitaciones, investigaciones, inteligencia comercial e informes), pruebas específicas de denegación para viewer/no miembro y pruebas PostgreSQL de integración para autorización y aislamiento multiworkspace. También hay pruebas de autenticación JWT y validación de identificadores. No se debe interpretar esta matriz como una certificación exhaustiva: al añadir o cambiar rutas, deben incorporarse casos positivos/negativos y actualizar esta tabla. La integración real con Supabase Auth, RLS (si se habilita acceso directo) y las pruebas externas de seguridad siguen pendientes.


## Evidencia y límites de la revisión actual

- Los tests HTTP de módulos cubren reglas de rol, validación y ausencia de escrituras ante denegación en las familias de rutas descritas.
- La suite `tests/integration/postgres-authorization-http.test.js` ejecuta autorización con PostgreSQL real de CI y separa workspaces/identidades para comprobar permisos y aislamiento.
- `tests/modules/market-intelligence/market-tenant-isolation-http.test.js` cubre denegaciones y aislamiento en superficies de inteligencia comercial e informes.
- La suite no sustituye pruebas de penetración, fuzzing sistemático ni validación contra un proyecto Supabase real.
