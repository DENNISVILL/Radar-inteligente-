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
| Lectura o modificación de datos de otro workspace (IDOR / elevación de privilegios) | Alto | Verificación de membresía y rol en servidor; consultas con workspace; restricciones relacionales PostgreSQL; pruebas de aislamiento parciales | Ampliar la matriz HTTP a todos los módulos y rutas de informes/PDF antes de producción. |
| Uso de invitación por una identidad cuyo correo no está verificado | Alto | Token aleatorio de 32 bytes, hash almacenado, expiración, revocación, comparación de correo y consumo transaccional de un solo uso | Confirmar el claim de verificación del proveedor real y exigir correo verificado antes de aceptar. Actualmente la identidad local conserva el correo, pero el flujo no exige un claim de correo verificado. |
| Robo o exposición de tokens de invitación | Alto | Solo se almacena SHA-256; el token se devuelve al crear y no se guarda en texto plano | No registrar cuerpos/respuestas sensibles; distribuir por canal seguro; no activar correo hasta definir remitente y protección contra abuso. |
| Fuerza bruta / abuso de endpoints | Medio | Rate limit por IP y ruta, límites específicos para aceptación, 429 y cabeceras | El contador es en memoria y no coordina instancias. Sustituir por almacenamiento compartido antes de escalar. |
| Suplantación de IP detrás de proxy | Medio | Fastify no confía por defecto en cabeceras de proxy | Configurar únicamente proxies conocidos mediante una lista de confianza; no habilitar confianza indiscriminada. |
| Exposición de secretos o acceso directo a datos | Alto | Credenciales configuradas por entorno; conexión desde backend | No hay entorno productivo ni secret manager verificado. Usar secretos de despliegue, red privada y rol PostgreSQL de mínimo privilegio. No exponer credenciales al cliente. |
| Manipulación de informes históricos | Medio | Snapshots versionados, hash SHA-256 y bloqueo de actualización | Mantener pruebas de integridad y restringir privilegios de escritura directa a tablas de snapshots. |
| Denegación de servicio por cuerpos o solicitudes lentas | Medio | Límite de cuerpo 1 MiB, timeout HTTP y rate limit | Añadir pruebas de carga, límites de conexión y métricas al preparar hosting. |
| Falta de detección de incidentes | Alto | Auditoría de acciones de negocio | Faltan métricas, trazas, alertas, retención y procedimiento de respuesta. |

## 5. Controles observados en código

- JWT: validación criptográfica con JWKS, issuer, audience `authenticated` y lista explícita de algoritmos ES256/RS256.
- Autorización: los roles se resuelven desde membresías persistidas; no se debe confiar en un rol enviado por el cliente.
- Invitaciones: token de 256 bits, hash SHA-256, caducidad de siete días, revocación y transacción con bloqueo.
- HTTP: límite de cuerpo de 1 MiB, timeout de 15 segundos, errores internos genéricos y redacción de Authorization/Cookie en logs.
- Rate limiting: límite por IP/ruta y tamaño máximo de buckets para acotar memoria.
- PostgreSQL: relaciones con workspace y restricciones de integridad; pruebas concurrentes para aceptación de invitaciones y cambios de miembros.

## 6. Acciones obligatorias antes de producción

1. Exigir y probar correo verificado para aceptar invitaciones, según el claim real del proveedor de identidad.
2. Completar pruebas HTTP de aislamiento, autorización, respuestas 401/403/404/409 y acceso a informes/PDF.
3. Decidir y probar RLS si se habilita acceso directo desde clientes; mantener la API como frontera de autorización mientras tanto.
4. Sustituir el rate limiter en memoria por un almacén compartido cuando exista más de una instancia.
5. Configurar proxy de confianza de forma explícita al desplegar detrás de un balanceador.
6. Añadir métricas, trazas, alertas, copias de seguridad y pruebas de restauración.
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
