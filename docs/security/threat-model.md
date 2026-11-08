# Revisión de seguridad y modelo de amenazas — Radar Comercial

**Estado:** revisión estática de la rama `backend/foundation`  
**Alcance:** API Fastify, autenticación JWT/JWKS, autorización por workspace, PostgreSQL, invitaciones, auditoría y controles HTTP.  
**Fuera de alcance:** infraestructura productiva, configuración real de Supabase, políticas RLS, secretos desplegados, frontend y pruebas de penetración externas.

## 1. Resumen ejecutivo

La API ya aplica autenticación Bearer, autorización por rol y comprobaciones de pertenencia al workspace en el servidor. Las consultas SQL revisadas usan parámetros; las migraciones refuerzan relaciones entre entidades y evitan algunas referencias cruzadas entre workspaces. Las invitaciones almacenan el hash SHA-256 de un token aleatorio de 256 bits y su aceptación se serializa mediante bloqueo transaccional.

**Conclusión:** existe una base razonable de controles para continuar el desarrollo, pero el backend **no debe considerarse listo para producción**. Antes de abrir el servicio a usuarios reales deben cerrarse o aceptarse formalmente los riesgos de verificación de correo en invitaciones, aislamiento de base de datos, rate limiting distribuido, configuración del proxy y observabilidad.

## 2. Activos que requieren protección

- Datos de investigaciones, competidores, productos, precios y observaciones.
- Informes comerciales, snapshots y documentos PDF.
- Identidades, correos, membresías y roles.
- Tokens de acceso JWT y tokens de invitación.
- Registros de auditoría.
- Credenciales de conexión a PostgreSQL y configuración de autenticación.

## 3. Límites de confianza

1. **Cliente → API:** toda entrada HTTP, parámetros, filtros y cuerpos JSON se consideran no confiables.
2. **API → proveedor de identidad:** la API valida JWT con issuer, audience, algoritmo permitido y JWKS remoto.
3. **API → PostgreSQL:** la API aplica autorización de workspace antes de operar; PostgreSQL impone claves foráneas, restricciones e integridad.
4. **Workspace → workspace:** el identificador de workspace recibido en la URL no concede acceso; se debe verificar la membresía y el rol.
5. **Invitación → cuenta:** un token de invitación no debe bastar por sí solo; la identidad autenticada debe corresponder al correo invitado y ese correo debe estar verificado por el proveedor.

## 4. Amenazas y controles

| Amenaza | Impacto | Controles existentes | Riesgo / acción requerida |
|---|---|---|---|
| Lectura o modificación de datos de otro workspace (IDOR / elevación de privilegios) | Alto | Verificación de membresía y rol en servidor; consultas con workspace; restricciones relacionales PostgreSQL; pruebas HTTP y PostgreSQL de aislamiento entre workspaces en investigaciones, competidores, productos, precios, observaciones, análisis, informes, snapshots y PDF | Mantener pruebas al añadir rutas nuevas; validar la integración con Supabase y cualquier futura política RLS antes de producción. |
| Uso de invitación por una identidad cuyo correo no está verificado | Alto | Token aleatorio de 32 bytes, hash almacenado, expiración, revocación, comparación de correo y consumo transaccional de un solo uso; con clave pública Supabase configurada, la API consulta `GET /auth/v1/user` y exige `email_confirmed_at` | Validar el flujo contra el proyecto Supabase real antes de producción; CI usa un proveedor HTTP simulado y no sustituye esa integración. |
| Robo o exposición de tokens de invitación | Alto | Solo se almacena SHA-256; el token se devuelve al crear y no se guarda en texto plano | No registrar cuerpos/respuestas sensibles; distribuir por canal seguro; no activar correo hasta definir remitente y protección contra abuso. |
| Fuerza bruta / abuso de endpoints | Medio | Rate limit por IP y ruta, límites específicos para aceptación, 429 y cabeceras | El contador es en memoria y no coordina instancias. Sustituir por almacenamiento compartido antes de escalar. |
| Suplantación de IP detrás de proxy | Medio | Fastify no confía por defecto en cabeceras de proxy | Configurar únicamente proxies conocidos mediante una lista de confianza; no habilitar confianza indiscriminada. |
| Exposición de secretos o acceso directo a datos | Alto | Credenciales configuradas por entorno; conexión desde backend | No hay entorno productivo ni secret manager verificado. Usar secretos de despliegue, red privada y rol PostgreSQL de mínimo privilegio. No exponer credenciales al cliente. |
| Manipulación de informes históricos | Medio | Snapshots versionados, hash SHA-256 y bloqueo de actualización | Mantener pruebas de integridad y restringir privilegios de escritura directa a tablas de snapshots. |
| Denegación de servicio por cuerpos o solicitudes lentas | Medio | Límite de cuerpo 1 MiB, timeout HTTP y rate limit | Añadir pruebas de carga, límites de conexión y métricas al preparar hosting. |
| Falta de detección de incidentes | Alto | Auditoría de acciones de negocio | Ya existen métricas HTTP Prometheus, correlación básica W3C traceparent y logs estructurados; siguen pendientes alertas, retención definida y procedimiento de respuesta. |

## 5. Controles observados en código

- JWT: validación criptográfica con JWKS, issuer, audience `authenticated` y lista explícita de algoritmos ES256/RS256.
- Autorización: los roles se resuelven desde membresías persistidas; no se debe confiar en un rol enviado por el cliente.
- Invitaciones: token de 256 bits, hash SHA-256, caducidad de siete días, revocación y transacción con bloqueo. Con `SUPABASE_URL` y clave pública configurados, se consulta Auth por solicitud y se exige `email_confirmed_at` para aceptar; no se confía en claims de correo no verificado.
- HTTP: límite de cuerpo de 1 MiB, timeout de 15 segundos, errores internos genéricos y redacción de Authorization/Cookie en logs.
- Rate limiting: límite por IP/ruta y tamaño máximo de buckets para acotar memoria.
- PostgreSQL: relaciones con workspace y restricciones de integridad; pruebas concurrentes para aceptación de invitaciones y cambios de miembros.

## 6. Acciones obligatorias antes de producción

1. Mantener la exigencia de correo confirmado en el flujo de invitaciones y validar la integración contra el proyecto Supabase real; la CI simula JWKS/Auth.
2. Mantener la matriz HTTP de aislamiento y autorización ampliada, incluyendo 401/403/404/409 y acceso a informes/PDF; añadir casos negativos para cada nueva ruta.
3. Decidir y probar RLS si se habilita acceso directo desde clientes; mantener la API como frontera de autorización mientras tanto.
4. Sustituir el rate limiter en memoria por un almacén compartido cuando exista más de una instancia.
5. Configurar proxy de confianza de forma explícita al desplegar detrás de un balanceador.
6. Configurar alertas y retención, y establecer copias de seguridad automáticas con pruebas documentadas de restauración.
7. Ejecutar pruebas de carga y una revisión de seguridad externa antes de abrir el servicio.

## 7. Criterios de aceptación

- Un usuario no puede leer ni mutar recursos de otro workspace cambiando UUIDs.
- Un rol viewer no puede ejecutar operaciones de escritura.
- Una invitación solo puede ser consumida una vez por una cuenta activa con correo verificado coincidente.
- La eliminación o degradación simultánea de propietarios nunca deja el workspace sin owner.
- Los tokens y credenciales no aparecen en logs ni en respuestas de error.
- Los límites de abuso funcionan entre todas las instancias desplegadas.
- Se puede detectar una tasa anómala de errores/429 y recuperar la base desde una copia probada.

**Dictamen:** revisión estática completada con riesgos y medidas pendientes documentados. No constituye certificación, pentest ni aprobación de despliegue productivo.

## 8. Integridad y acceso a registros de auditoría
- La migración `010_audit_log_immutability.sql` instala triggers PostgreSQL que rechazan `UPDATE`, `DELETE` y `TRUNCATE` directos sobre `audit_logs`.
- Las referencias a workspace y actor usan `ON DELETE SET NULL`: borrar una empresa o una cuenta no elimina el evento histórico; se conserva su tipo, recurso, metadatos y fecha, aunque se pierde la referencia al registro eliminado.
- Las actualizaciones internas ejecutadas por las acciones referenciales de PostgreSQL pueden desvincular esas referencias; la aplicación no puede usar el endpoint HTTP para reescribir eventos.
- Actualmente no existe una ruta HTTP para listar, modificar o borrar registros de auditoría. Por tanto, no se expone un recurso de auditoría al cliente. Si se añade lectura, deberá autorizarse por workspace y rol, paginarse, limitar filtros y probar aislamiento entre tenants.
- Los triggers protegen contra operaciones SQL ordinarias de la aplicación, no contra un propietario/superusuario de PostgreSQL que pueda desactivar triggers o alterar el esquema. En producción se requiere un rol de runtime que no sea propietario de tablas ni tenga privilegios DDL, además de credenciales administrativas separadas y acceso restringido.
- Los registros de auditoría contienen metadatos de negocio: evitar incluir tokens, contraseñas, cabeceras de autenticación, datos personales innecesarios o contenido íntegro de documentos.
- La inmutabilidad no sustituye copias de seguridad, retención legal, exportación externa ni almacenamiento WORM. Definir retención y destino de respaldo antes de producción.


## 9. Revalidación transaccional de membresía (TOCTOU)

- Las escrituras de investigación y de inteligencia comercial revalidan la membresía dentro de la misma transacción que modifica el recurso y registra la auditoría.
- La transacción bloquea primero la fila de `workspaces` (`FOR UPDATE`) y después la membresía del actor (`FOR UPDATE OF wm`). Este orden coincide con las operaciones de alta/baja/cambio de miembros e invitaciones que ya bloquean primero el workspace.
- La ruta de snapshots de informes usa el mismo orden de bloqueo y revalida el rol antes de consultar la evidencia y guardar el snapshot.
- Roles autorizados para escrituras de negocio: owner, admin y analyst. Si la membresía desapareció, la cuenta fue deshabilitada o el rol cambió a viewer, la operación termina con 403 y rollback antes de ejecutar la mutación.
- Las escrituras de negocio de estos módulos pasan por el mismo bloqueo de workspace; esto también serializa cambios de datos del workspace mientras se construye un snapshot, conservando una vista coherente sin mantener un snapshot REPEATABLE READ anterior a la revalidación de membresía.
- Se añadieron pruebas unitarias para membresía revocada/degradada y una prueba de integración PostgreSQL que confirma que una persona eliminada del workspace no puede insertar el recurso ni su auditoría.
- Este control cubre las mutaciones de investigación, inteligencia comercial y snapshots. Las lecturas HTTP siguen usando autorización previa y consultas filtradas por workspace; si se habilita acceso directo de clientes a PostgreSQL, se deberá diseñar y probar RLS con claims de tenant confiables, no confiar en el UUID enviado por el navegador.

## 10. Rate limiting: rutas no registradas y agotamiento de buckets

- El limitador usa la plantilla de ruta registrada (`routeOptions.url`) como parte de la clave, no la URL literal enviada por el cliente.
- Las solicitudes que no coinciden con una ruta registrada comparten el bucket `__unmatched__` por IP. Esto evita que un cliente cree un bucket distinto por cada URL aleatoria y consuma toda la capacidad con rutas inexistentes.
- La capacidad sigue acotada por `maxBuckets`; los buckets activos no se expulsan para admitir claves nuevas. Si no hay capacidad libre ni ventanas expiradas que limpiar, la API responde temporalmente 503 `RATE_LIMIT_CAPACITY` con `Retry-After`.
- Prueba de regresión: dos URLs inexistentes distintas desde la misma IP comparten el mismo contador y la segunda solicitud alcanza el límite.
- Validación: CI #543 aprobada, incluyendo pruebas automatizadas, integración PostgreSQL, benchmark de API, backup/restauración, OpenAPI y sintaxis. [Ejecución CI #543](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42486715691).
- Límite restante: el contador sigue en memoria por proceso. Antes de operar varias instancias, se requiere un almacén compartido con incrementos atómicos y pruebas de concurrencia.
