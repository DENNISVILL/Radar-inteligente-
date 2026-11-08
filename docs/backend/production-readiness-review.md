# Revisión de preparación operativa — Radar Comercial

**Fecha de revisión:** 2026-11-08  
**Rama revisada:** `backend/foundation`  
**Alcance:** inspección estática de configuración, servidor, pool PostgreSQL, rate limiting, health/readiness, migraciones, observabilidad, CI y documentación.  
**Dictamen:** backend funcional y con CI aprobada; **no apto todavía para despliegue productivo abierto**.

## 1. Evidencia verificada

- CI #549 (push): [ejecución aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42486922330).
- CI #550 (Pull Request): [ejecución aprobada](https://github.com/DENNISVILL/Radar-inteligente-/actions/runs/42486928367).
- Ambas ejecuciones validan el head `e0ef9d1227a687c84cc8da271491c0a9fa1cce50`; el job `Tests and syntax` terminó en `success` en ambas.
- La ejecución más reciente completó pruebas automatizadas e integración PostgreSQL, baseline de rendimiento, backup y restauración en base vacía, validación OpenAPI y sintaxis JavaScript. Todos los pasos finalizaron correctamente.
- PostgreSQL 16 de servicio en CI.
- Benchmark escalonado con 1, 5, 20 y 50 trabajadores; todos los escenarios cumplieron el umbral P95 de 1.000 ms.
- OpenAPI validado y comprobación de sintaxis aprobada.
- Health y readiness implementados; readiness ejecuta `SELECT 1` y responde 503 si PostgreSQL no está disponible.
- Cierre ordenado del servidor y pool ante SIGINT/SIGTERM.
- Migraciones serializadas con advisory lock y transacción individual por migración.
- Rate limiting por IP/ruta en memoria, no compartido entre instancias. Usa plantillas de rutas registradas y agrupa rutas no registradas bajo `__unmatched__` por IP para impedir que URLs aleatorias creen buckets ilimitados. Al alcanzar `maxBuckets`, elimina únicamente buckets expirados; si la capacidad sigue llena, conserva las ventanas activas y responde 503 `RATE_LIMIT_CAPACITY` con `Retry-After`. Prueba de regresión incluida y aprobada en CI #543.
- Métricas HTTP Prometheus y correlación básica de trazas; `/metrics` deshabilitado por defecto. No hay exportador OpenTelemetry ni sistema de alertas configurado.
- Verificación JWT distingue tokens inválidos (401) de indisponibilidad del proveedor JWKS (503); prueba HTTP simula respuesta 503 del endpoint JWKS y confirma que no se consulta la base de datos.
- Las operaciones de escritura de miembros e invitaciones vuelven a comprobar el rol actual del actor dentro de la transacción y bajo bloqueo de la fila del workspace. La aceptación y revocación de invitaciones usan el mismo orden de bloqueo (workspace y luego invitación) para evitar la inversión de bloqueos.

## 2. Hallazgos y acciones

| Prioridad | Hallazgo | Estado actual | Acción para cerrar |
|---|---|---|---|
| Crítica antes de usuarios reales | Aceptación de invitaciones no exige correo confirmado | Corregido en código y CI: con introspección Supabase habilitada se consulta `GET /auth/v1/user`, se usa el correo devuelto por Auth y se exige `email_confirmed_at` antes de aceptar. | Conectar el proyecto real y ejecutar pruebas de aceptación contra su configuración Auth; CI cubre respuestas simuladas. |
| Alta | No hay copias automáticas externas ni política de recuperación productiva | Existen `npm run db:backup` y `npm run db:restore`; CI valida un ciclo real PostgreSQL 16 en una base separada. No hay proveedor ni almacenamiento externo configurados. | Elegir hosting/servicio PostgreSQL, definir RPO/RTO, automatizar backups cifrados con retención/alertas y ejecutar una restauración en el proveedor final |
| Alta | Rate limiter no distribuido | Contadores en memoria por proceso | Antes de ejecutar más de una instancia, usar Redis u otro almacén compartido con límites atómicos |
| Alta | Métricas expuestas por ruta sin autenticación propia | Corregido y probado en CI #275 y #346: `/metrics` queda deshabilitado por defecto; solo se registra con `METRICS_ENABLED=true`. La opción de habilitarlo sigue requiriendo red privada o restricción de proxy/firewall. | Antes de producción, habilitarlo solo si el entorno lo necesita y comprobar desde fuera que no sea accesible públicamente |
| Alta | Sin alertas ni política de retención | Logs y métricas se generan, pero no hay destino/alertas configurados | Definir proveedor de observabilidad, alertas de errores/latencia/DB/429, retención y responsables |
| Alta | Privilegios y conectividad de PostgreSQL no verificados en entorno real | Pool configurado con máximo 10 conexiones; TLS opcional vía `DB_SSL` | Crear rol de mínimo privilegio, restringir red, activar TLS con certificados verificados y dimensionar pool según límite del hosting |
| Media | Proxy de confianza depende del despliegue | Fastify no habilita `trustProxy` en la configuración actual | Mantener desactivado salvo necesidad; si se usa proxy, confiar solo en IPs/CIDRs del proxy administrado |
| Alta | Autorización de escritura podía usar el rol leído antes de adquirir el bloqueo transaccional | Corregido y probado en CI #346: las operaciones de alta/cambio/baja de miembros y creación/revocación de invitaciones vuelven a consultar el rol vigente del actor dentro de la transacción, después de bloquear el workspace. La aceptación y revocación de invitaciones siguen un orden de bloqueo común; una prueba PostgreSQL compite ambas operaciones y verifica que solo una pueda completar el ciclo de vida. | Mantener pruebas de concurrencia al ampliar la gestión de roles e invitaciones |
| Media | Prueba de rendimiento es in-process | Usa `Fastify.inject()` y PostgreSQL en runner CI | Repetir en staging con red, TLS, proxy, recursos y pool equivalentes a producción |
| Media | Despliegue real aún no ensayado | Hay runbook de backup/restauración y recuperación ante migración fallida; no hay entorno staging ni proveedor final para validar el procedimiento extremo a extremo. | Ensayar en staging con backup previo, migraciones compatibles, restauración y plan de reversión |

### Nota técnica sobre la verificación de correo

La verificación de firma JWT solo demuestra que el token fue emitido por el proyecto y no fue alterado; no demuestra por sí sola que el correo esté confirmado. La referencia de claims de Supabase enumera `email` como claim estándar, pero no `email_verified`. El endpoint autenticado `GET /auth/v1/user` devuelve el perfil de usuario, incluido `email_confirmed_at`; la integración deberá usar la clave publicable del proyecto en `apikey` y el access token del usuario en `Authorization`, nunca una clave `service_role` en el cliente. Como Radar todavía no tiene un proyecto Supabase conectado ni esa configuración, esta comprobación queda documentada como bloqueo y no se simula con un claim inventado.

Referencias oficiales:
- [Supabase — JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase — Auth User endpoint](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase — JWT verification](https://supabase.com/docs/guides/auth/jwts)

## 3. Controles que sí existen

- `/health` para liveness y `/ready` para comprobar PostgreSQL.
- Límite de cuerpo HTTP de 1 MiB y timeout de solicitud de 15 segundos.
- Pool PostgreSQL con timeout de conexión de 5 segundos y cierre ordenado.
- SSL de PostgreSQL configurable con validación de certificado cuando se activa.
- Fastify no confía por defecto en cabeceras de proxy.
- Rate limit por IP/ruta con cabeceras RateLimit y respuesta 429; capacidad acotada, limpieza de ventanas expiradas y rechazo temporal 503 cuando no hay espacio para un cliente nuevo sin alterar ventanas activas. Prueba de regresión incluida.
- Mutaciones de miembros e invitaciones revalidan el rol del actor bajo el bloqueo del workspace. Aceptación y revocación de invitaciones adquieren bloqueos en orden workspace → invitación; las pruebas PostgreSQL de aceptación concurrente y ciclo de vida están aprobadas en CI #352.
- Logs estructurados con redacción de Authorization y Cookie.
- Errores temporales del proveedor de identidad no se presentan como credenciales inválidas; la API responde 503 y falla de forma cerrada.
- Endpoint de métricas con rutas registradas como etiquetas para limitar cardinalidad; deshabilitado por defecto y opt-in mediante `METRICS_ENABLED=true`.
- Migraciones protegidas con advisory lock y transacciones.
- CI ejecuta pruebas PostgreSQL, benchmark, OpenAPI y sintaxis.

## 4. Orden recomendado de cierre

1. **Identidad:** conectar Supabase real y cerrar la verificación de correo en invitaciones.
2. **Base de datos:** decidir proveedor/hosting, rol SQL mínimo, TLS, red privada, límites de conexiones y backups.
3. **Recuperación:** realizar una restauración de prueba y registrar el procedimiento; un backup no se considera validado hasta restaurarlo.
4. **Exposición de servicio:** decidir acceso a `/metrics`, proxy confiable, TLS público, secretos y límites compartidos.
5. **Observabilidad:** configurar destino de logs/métricas, alertas, retención y respuesta a incidentes.
6. **Staging:** ejecutar prueba de carga de red real y pruebas de aceptación/seguridad antes de abrir acceso público.

## 5. Decisiones que requieren al propietario

No se deben inventar ni simular estas decisiones: proveedor de hosting, servicio PostgreSQL, dominio, presupuesto, proveedor de correo, proyecto Supabase y política de retención. Hasta que estén definidos, estas tareas permanecen pendientes.

## 6. Conclusión

El cierre de 29/29 entregables describe la fase principal de construcción del backend, no la preparación integral para producción. La validación CI #352 (199 pruebas, 0 fallidas) confirma la calidad automatizada del código actual, pero no sustituye la configuración de infraestructura, recuperación, seguridad externa ni pruebas de staging.


## 7. Revisión adicional de cobertura de auditoría

- La creación de un workspace y la asignación de su propietario inicial se registran ahora como dos eventos (`workspace.created` y `workspace_member.added`) en la misma transacción que las inserciones de dominio. Si falla cualquiera de los dos INSERT de auditoría, la transacción completa se revierte.
- El actor de esos eventos se toma del usuario local resuelto a partir de la identidad autenticada por el servidor; no se acepta un identificador de actor enviado por el cliente.
- Se añadieron pruebas unitarias para verificar ambos eventos, el orden transaccional y el rollback ante fallo de auditoría.
- El CRUD del módulo de investigaciones (`POST`, `PATCH`, `DELETE`) ahora usa mutaciones auditadas: `research.created`, `research.updated` y `research.archived` se escriben en la misma transacción que la mutación. Un fallo al insertar auditoría provoca rollback; se añadieron pruebas HTTP para comprobar actor autenticado, eventos y reversión.
- La cobertura automatizada de auditoría sigue limitada a las mutaciones implementadas en los módulos actuales; nuevas mutaciones futuras deberán seguir el mismo patrón.
- Las operaciones de miembros e invitaciones ya escriben sus eventos en la transacción de mutación; las rutas de inteligencia de mercado usan `executeAuditedMutation` para que un fallo de auditoría revierta la mutación.
- La tabla permite `actor_user_id` nulo por `ON DELETE SET NULL`, preservando el evento si se elimina posteriormente una cuenta local. Esto es una decisión de retención histórica; no permite al cliente elegir actor, porque las escrituras toman el actor desde la sesión autenticada.

## 9. Separación de roles PostgreSQL — implementación y validación

- La API usa `DATABASE_URL`; el ejecutor `npm run db:migrate` usa `MIGRATION_DATABASE_URL`.
- En `NODE_ENV=production`, el runner rechaza iniciar si falta `MIGRATION_DATABASE_URL`; no cae silenciosamente en la credencial runtime.
- Se añadió un aprovisionador para bases nuevas: `database/roles/production-roles.sql`. Crea `radar_migration_owner` y `radar_runtime` sin superusuario, CREATEDB ni CREATEROLE.
- Tras migrar, el runner concede al runtime DML sobre tablas operativas y uso de secuencias, pero solo INSERT en `audit_logs`, ningún privilegio sobre `schema_migrations` y ningún CREATE en `public`.
- Se añadieron pruebas de configuración y una prueba PostgreSQL de privilegios con `has_table_privilege` y `has_schema_privilege`.
- **Alcance:** la automatización está preparada para una base nueva y aislada. La adopción en una base existente requiere inventario y cambio de propietarios controlado; no se debe ejecutar el bootstrap sin revisión.
- **Pendiente operativo:** no hay base productiva conectada, por lo que todavía no se han probado credenciales reales, TLS, restricciones de red ni restauración de backups. La prueba CI valida privilegios PostgreSQL en un entorno efímero, no la configuración del proveedor final.

## 8. Integridad de auditoría — revisión adicional
- La migración `010_audit_log_immutability.sql` impide `UPDATE`, `DELETE` y `TRUNCATE` ordinarios sobre `audit_logs` mediante triggers de PostgreSQL.
- Las referencias a workspace y actor se desvinculan con `ON DELETE SET NULL`; el evento histórico permanece aunque se elimine posteriormente la empresa o la cuenta. La retención y el respaldo externo siguen pendientes de definir.
- No hay rutas HTTP para consultar o mutar registros de auditoría. No se ha añadido una superficie de lectura sin un requisito de producto y una matriz de permisos definida.
- Límite del control: un propietario/superusuario de PostgreSQL puede desactivar triggers o alterar el esquema. Antes de producción, crear un rol de runtime sin propiedad de tablas ni privilegios DDL, separado del rol de migraciones.
- La CI incorpora pruebas PostgreSQL de rechazo de actualización, borrado y truncado, además de conservación del evento tras eliminar workspace/actor.


## 10. Respaldo, restauración y recuperación de migraciones

- Se añadieron `npm run db:backup` y `npm run db:restore`. El primero crea un dump PostgreSQL custom-format sin sobrescribir archivos y comprueba que `pg_restore --list` pueda leerlo.
- El restaurador exige confirmación exacta del nombre de la base, que el destino esté vacío y que el usuario conectado sea `radar_migration_owner`, propietario de la base. Ejecuta `pg_restore` con `--exit-on-error --single-transaction --no-owner --no-privileges`; no usa `--clean`.
- La CI realiza un ciclo completo en PostgreSQL 16: genera backup de la base de pruebas, restaura en una segunda base vacía propiedad del migrador, reaplica grants runtime y consulta el historial y las tablas restauradas.
- Cada migración mantiene transacción individual. Una prueba fuerza el fallo de una migración y comprueba que se revierte esa migración, mientras que la anterior ya confirmada permanece aplicada. Los grants runtime también se ejecutan dentro de una transacción.
- **No confundir validación CI con backups productivos:** no se ha configurado todavía almacenamiento externo cifrado, agenda, retención, alertas, PITR ni restauración en proveedor real. El archivo local no se cifra por sí mismo.
- **Bloqueo antes de datos reales:** elegir proveedor, definir RPO/RTO, retención y responsable; activar backups administrados/cifrados y probar restauración periódica en un entorno aislado.


## 11. Ciclo de vida JWT, sesión y cuentas — controles implementados

- El verificador exige claims `sub`, `iat`, `exp` y `session_id`, valida firma mediante JWKS, emisor, audiencia y algoritmos asimétricos permitidos (ES256/RS256). Rechaza tokens sin expiración, sin fecha de emisión, demasiado antiguos o con identificador de sesión mal formado.
- La antigüedad máxima se configura mediante `SUPABASE_JWT_MAX_AGE_SECONDS`, con valor por defecto 3600 segundos y límites de 300 a 86400. Debe mantenerse alineada con la expiración JWT configurada en el proyecto Supabase.
- Cuando se configura `SUPABASE_URL`, la configuración exige una clave pública `SUPABASE_PUBLISHABLE_KEY` o la clave heredada `SUPABASE_ANON_KEY`. En cada solicitud autenticada, Radar consulta `GET /auth/v1/user` con la clave pública y el access token del usuario. No se utiliza `service_role`.
- La introspección remota actualiza el correo desde la respuesta de Auth y expone internamente `email_confirmed_at`; la aceptación de invitaciones rechaza correos no confirmados. No se confía en un claim `email_verified` no garantizado.
- Una respuesta 401/403 del proveedor se transforma en 401; un timeout, error de red, 429 o error 5xx del proveedor se transforma en 503. El backend no acepta el token solo por la firma si la comprobación remota configurada falla.
- `GET /api/v1/me` consulta el estado de la cuenta local y devuelve 403 si está deshabilitada. Las rutas de workspace ya exigen usuarios activos mediante `findWorkspaceAccess` y `ensureIdentityUser`.
- La API recibe solo access tokens. La renovación y el cierre de sesión se realizan en el cliente oficial Supabase Auth; no se añade un endpoint propio de refresh ni se almacena el refresh token.
- **Limitación inherente:** Supabase usa access tokens JWT stateless. Tras signOut o revocación, un token emitido puede seguir siendo válido hasta su expiración si solo se verifica localmente. La consulta remota por solicitud está activada cuando se configura la clave pública y permite detectar sesiones que Auth ya no reconoce. El proyecto real todavía no está conectado, por lo que CI usa un servidor HTTP local simulado y no acredita la configuración del proyecto de producción.
- Pruebas añadidas: claims ausentes, token expirado, token antiguo, session_id mal formado, sesión revocada (401), Auth indisponible (503), cuenta local deshabilitada (403), correo sin confirmar y correo confirmado.
- Variables nuevas: `SUPABASE_PUBLISHABLE_KEY` (o `SUPABASE_ANON_KEY`) y `SUPABASE_JWT_MAX_AGE_SECONDS`.


## 8. Revalidación de evidencia (2026-11-08)

- CI #549 (push) y CI #550 (Pull Request) terminaron correctamente en el mismo head `e0ef9d1227a687c84cc8da271491c0a9fa1cce50`.
- Ambas ejecuciones tuvieron un único job (`Tests and syntax`) con conclusión `success`.
- La matriz de autorización fue actualizada para distinguir cobertura automatizada existente de cobertura exhaustiva o certificación externa.
- Los scripts de backup/restauración y su runbook están en el repositorio; su validación CI en PostgreSQL efímero no demuestra backups externos, cifrado, retención, PITR ni restauración del proveedor de producción.
- La instrumentación HTTP actual usa etiquetas de ruta registradas (y una etiqueta común `unmatched`), histogramas y un gauge de solicitudes activas. `/metrics` permanece deshabilitado por defecto. No hay exportador OpenTelemetry, destino remoto, retención ni alertas configuradas.


## 9. Endurecimiento de credenciales de backup (2026-11-08)

- `scripts/backup.js` y `scripts/restore.js` ya no colocan la URL de conexión PostgreSQL en los argumentos del proceso. La contraseña se entrega mediante un `.pgpass` temporal de permisos `0600`, eliminado incluso si el comando falla.
- Se añadieron pruebas para verificar permisos del archivo, escape de `:` y `\\`, ausencia de `PGPASSWORD` y limpieza del archivo temporal al finalizar o fallar.
- `METRICS_ENABLED` permanece desactivado por defecto. Si se activa, `/metrics` debe quedar accesible únicamente desde la red de monitorización o detrás de controles de acceso del proxy; no publicarlo abiertamente en Internet.
- No hay todavía un backend remoto de métricas/trazas ni reglas de alertas. Los logs actuales se emiten por el logger de la aplicación y su retención depende del entorno de ejecución.


## 12. Runbook de observabilidad y alertas (2026-11-08)

- Se añadió `docs/backend/observability-runbook.md` con consultas Prometheus de referencia para tasa 5xx, p95, solicitudes activas y disponibilidad de scrape.
- El runbook diferencia expresamente las métricas que Radar ya emite de las señales que requieren un proveedor externo: disponibilidad HTTP desde fuera, conexiones/uso de PostgreSQL, antigüedad de backups y resultado de restauraciones.
- Se documentaron umbrales iniciales de referencia (5xx >5% durante 10 minutos; p95 >1 segundo durante 10 minutos), sujetos a calibración con tráfico y pruebas de staging. No son reglas activas ni objetivos de servicio aprobados.
- Se documentó respuesta ante incidentes, correlación mediante trace ID, restricción de acceso a `/metrics`, retención y prohibición de etiquetas de alta cardinalidad o datos sensibles.
- La instrumentación actual mantiene métricas en memoria por proceso; no agrega réplicas ni persiste series tras reinicio. No existe aún exportador OpenTelemetry, backend remoto, dashboard, alert manager ni métricas de pool/backup.
- **Estado:** documentación operativa preparada; observabilidad productiva todavía no habilitada ni validada. Requiere proveedor, red privada, alertas, retención, responsables y simulacro en staging.


## 13. Consistencia TLS de restauración (2026-11-08)

- Se detectó que la validación previa de `scripts/restore.js` utilizaba únicamente `DB_SSL=true`, mientras que `pg_restore` también respetaba `sslmode` de la URL PostgreSQL a través de libpq.
- Se unificó la decisión TLS de la conexión de prevalidación con la intención de conexión CLI: modos `require`, `verify-ca` y `verify-full` habilitan TLS con certificado verificado; `DB_SSL=true` lo fuerza; modos de downgrade `allow` y `prefer` se rechazan. Se añadieron pruebas unitarias para estos casos.
- **Alcance:** pruebas unitarias de selección de configuración; no se ha probado un certificado ni un servidor PostgreSQL de proveedor real. La configuración TLS final debe probarse en staging con el CA/certificado del proveedor.


## 14. Atributos mínimos del rol PostgreSQL runtime (2026-11-08)

- Se corrigió el bootstrap `database/roles/production-roles.sql`: `radar_runtime` se configura explícitamente con `NOBYPASSRLS`, además de `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` y `NOREPLICATION`.
- Se revoca explícitamente `CREATE` sobre la base de datos al rol runtime y a `PUBLIC`; el permiso se reserva al rol de migraciones para la instalación de extensiones y cambios de esquema.
- La prueba PostgreSQL de migraciones ahora consulta `pg_roles` y falla si el rol runtime tiene cualquiera de esos atributos administrativos o `BYPASSRLS` activo.
- **Alcance:** validación automatizada en PostgreSQL efímero de CI. No reemplaza la revisión de membresías heredadas ni el inventario de roles de una base administrada real.


## 15. Consistencia TLS en todas las conexiones PostgreSQL (2026-11-08)

- Se centralizó la selección TLS de `node-postgres` en `src/infrastructure/database/postgres-ssl.js`; API, migraciones y prevalidación de restauración respetan `DB_SSL` y `sslmode`, con verificación de certificado y soporte de `sslrootcert`.
- `pg_dump` y `pg_restore` ahora reciben `PGSSLMODE=verify-full` cuando TLS está habilitado, y `disable` cuando no lo está, para evitar que libpq degrade silenciosamente la conexión. Se rechazan `allow` y `prefer`.
- Se añadieron pruebas unitarias para CA privada, modos TLS, rechazo de downgrade y paridad entre la configuración de Node y las herramientas CLI.
- **Alcance:** pruebas de configuración. No se ha conectado un certificado ni servidor real de proveedor; la aceptación final exige prueba de staging con CA, hostname y política TLS reales.


## 16. Cabeceras HTTP de protección (2026-11-08)

- Se añadieron cabeceras comunes a todas las respuestas de la API, incluidas respuestas 404 y health: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Cross-Origin-Resource-Policy: same-origin`.
- Se agregó una prueba HTTP con Fastify inject que verifica las cinco cabeceras tanto en una ruta existente como en una ruta inexistente.
- No se fuerza HSTS desde la aplicación porque TLS puede terminar en un proxy administrado; HSTS debe configurarse en el punto de terminación TLS después de confirmar dominio y HTTPS. Tampoco se habilita CORS global: no hay orígenes frontend de producción definidos y permitir `*` sería una ampliación innecesaria de superficie.
- Fastify mantiene `trustProxy` desactivado por defecto. Si el despliegue incorpora proxy, la confianza deberá limitarse a las IP/CIDR reales del proxy.


## 17. Cierre ordenado ante señales y errores de inicio (2026-11-08)

- Se centralizó el apagado en `createShutdownHandler`: procesa una sola secuencia aunque lleguen SIGINT y SIGTERM casi simultáneamente, cierra Fastify y después PostgreSQL.
- Si el cierre de Fastify falla, el cierre del pool PostgreSQL se intenta igualmente; los errores se registran y el proceso marca `exitCode=1`, sin forzar `process.exit()` antes de liberar recursos.
- Si falla la comprobación inicial de PostgreSQL o el bind del servidor, se intenta cerrar tanto Fastify como el pool y se conserva el código de salida de error.
- Se añadieron pruebas para señales simultáneas y para garantizar que PostgreSQL se cierre incluso si Fastify falla. El helper también quedó incluido en el chequeo de sintaxis.
- **Alcance:** pruebas unitarias del coordinador de apagado; el comportamiento final de señales y terminación deberá observarse también en staging bajo el supervisor/proveedor elegido.


## 18. Protección de respuestas ante errores internos (2026-11-08)

- Se añadió una prueba HTTP de regresión que provoca un error interno con una cadena que simula credenciales y detalles de conexión PostgreSQL.
- La prueba verifica que el cliente reciba únicamente HTTP 500, el código estable `INTERNAL_SERVER_ERROR` y un mensaje genérico; no deben aparecer credenciales, host interno ni stack trace en el cuerpo de respuesta.
- El error original sigue registrándose en el logger del servidor para diagnóstico. La retención, el acceso y la protección de esos logs deben configurarse en el entorno de despliegue.
- **Alcance:** la prueba valida la respuesta HTTP de Fastify; no demuestra por sí sola la seguridad del destino de logs ni sustituye la revisión de permisos operativos.


## 19. Límite de resultados para invitaciones pendientes (2026-11-08)

- La consulta de invitaciones pendientes ahora aplica un límite SQL parametrizado: 50 registros por defecto y un máximo permitido de 100.
- La ruta valida el parámetro `limit`; valores no enteros, inferiores a 1 o superiores a 100 se rechazan con HTTP 400 antes de consultar la tabla de invitaciones.
- OpenAPI documenta el parámetro compartido `limit100`; las pruebas HTTP verifican el límite por defecto, un valor explícito y entradas inválidas.
- **Alcance:** se limita el tamaño de cada respuesta, no se implementa paginación por cursor ni una política de retención. La lista devuelve las invitaciones pendientes más recientes; una interfaz que necesite recorrer más de 100 registros deberá solicitar paginación en una mejora posterior.


## 20. Protección contra borrado directo de snapshots de informes (2026-11-08)

- La revisión detectó que la migración 008 impedía modificar snapshots (UPDATE), pero no impedía borrarlos directamente (DELETE).
- La migración 011 añade un trigger BEFORE DELETE que rechaza el borrado directo de filas de market_reports con SQLSTATE 55000.
- Se conserva el borrado en cascada cuando se elimina la investigación o el workspace padre; el trigger distingue la acción referencial mediante la profundidad de triggers de PostgreSQL.
- Se añadieron pruebas: verificación estática de la migración y una prueba de integración PostgreSQL que confirma que el borrado directo falla, el snapshot permanece y la eliminación del padre sí ejecuta la cascada.
- **Alcance:** la protección cubre DML ordinario del rol runtime. Un superusuario/propietario de esquema puede alterar triggers o migraciones; se mantiene la separación de roles y el control de acceso administrativo como requisito operativo.


## 21. Lectura transaccional y paginada del historial de auditoría (2026-11-08)

- La revisión detectó que la ruta de auditoría ya existía, pero la documentación de amenazas decía erróneamente que no había endpoint. También se identificó que la lectura se autorizaba antes de consultar los eventos, dejando una ventana TOCTOU frente a la revocación simultánea de membresía, y que solo podía consultarse la primera página.
- La consulta ahora inicia una transacción y bloquea primero el workspace activo (`FOR UPDATE`) y después la membresía (`FOR UPDATE OF wm`), en el mismo orden que las escrituras y cambios de membresía. Si el workspace dejó de estar activo o el actor no conserva rol owner/admin, revierte sin consultar auditoría.
- La paginación usa cursor keyset por `(created_at,id)` descendente, límite por defecto 50 y máximo 100. Se obtiene un registro adicional para determinar si existe página siguiente; `nextCursor` es opaco, se valida antes de abrir conexión y no usa offsets crecientes.
- La especificación OpenAPI y el modelo de amenazas reflejan el endpoint real y su política de acceso. Se añadieron pruebas de servicio y HTTP para orden de bloqueos, denegación por rol, workspace inactivo, paginación y cursor inválido.
- **Límite:** esto serializa la lectura respecto de operaciones que respetan el bloqueo de workspace. El acceso SQL administrativo puede saltarse el protocolo de aplicación; los triggers de inmutabilidad y la separación de roles siguen siendo necesarios.
