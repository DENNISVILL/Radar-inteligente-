# Respaldo y recuperación PostgreSQL

## Qué está implementado

- `npm run db:backup`: genera un archivo PostgreSQL en formato custom (`pg_dump`), no sobrescribe un archivo existente, limita permisos locales a propietario (`0600`) y comprueba que `pg_restore --list` pueda leer el archivo. Además crea un manifiesto JSON lateral (`<archivo>.sha256.json`) con versión, algoritmo SHA-256, digest y tamaño exacto. El manifiesto también se crea sin sobrescritura y con permisos `0600`.
- `npm run db:restore`: exige el manifiesto SHA-256 y verifica tamaño y digest antes de invocar `pg_restore` o conectarse a la base destino. Rechaza manifiestos ausentes, malformados o que no coincidan con el archivo. La restauración copia el respaldo a un directorio temporal privado (permisos de directorio restringidos y archivo `0600`), calcula SHA-256 durante esa copia y ejecuta `pg_restore` únicamente sobre esa copia ya verificada. Así evita que un cambio posterior en la ruta original sustituya el contenido entre la verificación y la restauración. También rechaza enlaces simbólicos como archivo de origen y elimina la copia temporal incluso si falla la restauración. Después exige que `RESTORE_CONFIRM_DATABASE` coincida exactamente con el nombre de la base destino, exige que la conexión sea el rol `radar_migration_owner`, exige que ese rol sea propietario de la base y rechaza destinos con tablas/vistas. Restaura en una sola transacción con `pg_restore --exit-on-error --single-transaction`.
- Las conexiones CLI usan variables estándar de libpq y la contraseña se escribe temporalmente en un archivo `.pgpass` con permisos `0600`; se elimina al terminar, incluso si falla el comando. La contraseña no aparece en los argumentos del proceso ni en sus variables de entorno.
- CI crea una copia real de la base PostgreSQL de pruebas, la restaura en otra base vacía y vuelve a ejecutar el runner para aplicar los permisos runtime. Verifica el historial y las tablas restauradas.
- Cada migración SQL se ejecuta dentro de su propia transacción. Si una migración falla, se revierte esa migración; las anteriores que ya hicieron COMMIT permanecen aplicadas. El bloque de grants runtime también se aplica en una transacción.

## Crear un respaldo

Requisitos: herramientas cliente PostgreSQL compatibles (`pg_dump` y `pg_restore`) instaladas y accesibles en PATH.

Ejemplo Bash:

```bash
export BACKUP_DATABASE_URL='postgresql://usuario:clave@host:5432/radar'
export BACKUP_FILE='/ruta/segura/radar-2026-11-08.dump'
npm run db:backup
```

El proceso genera dos archivos que deben conservarse juntos:
- `radar-2026-11-08.dump`: respaldo PostgreSQL.
- `radar-2026-11-08.dump.sha256.json`: manifiesto de integridad asociado.

Copiar, mover o renombrar el respaldo requiere conservar el manifiesto y mantener su sufijo. Si falta, la restauración se bloquea. El hash detecta corrupción o cambios accidentales, pero no cifra el respaldo ni autentica el origen del manifiesto si un atacante puede sustituir ambos archivos. Para almacenamiento remoto, proteger ambos con controles de acceso y cifrado, y considerar firma digital o almacenamiento inmutable.

El archivo y su manifiesto deben guardarse en almacenamiento cifrado, con acceso restringido y fuera del servidor de la aplicación. El script no cifra ni programa la copia: esa parte debe configurarse en el proveedor de almacenamiento/backup o mediante un gestor de secretos y una tarea programada. No subir respaldos a Git ni enviarlos por correo/chat.

## Restaurar sin sobrescribir datos

**Nunca restaurar encima de la base activa.** Primero crea una base de recuperación nueva y vacía en el proveedor, asigna como propietario a `radar_migration_owner`, y usa la credencial de ese rol para restaurar. El rol debe poder crear objetos en el esquema destino.

Ejemplo:

```bash
export RESTORE_FILE='/ruta/segura/radar-2026-11-08.dump'
export RESTORE_DATABASE_URL='postgresql://radar_migration_owner:clave@host:5432/radar_recovery'
export RESTORE_CONFIRM_DATABASE='radar_recovery'
npm run db:restore
```

La herramienta verifica primero el manifiesto SHA-256 y el formato PostgreSQL. Después exige que el nombre de confirmación coincida exactamente con el nombre de la base destino. Se detiene si el manifiesto falta/no coincide, si detecta tablas/vistas, si el rol no es el propietario esperado o si la restauración SQL falla. No se usa `--clean` ni `--if-exists`; por diseño no elimina objetos existentes.

Después de restaurar:

1. Ejecutar `npm run db:migrate` con `NODE_ENV=production` y `MIGRATION_DATABASE_URL` apuntando a la base restaurada. Esto revalida migraciones y reaplica grants de runtime.
2. Verificar el número de migraciones y tablas, restricciones, índices, triggers de auditoría y extensiones.
3. Ejecutar pruebas de lectura/escritura con una cuenta de prueba y confirmar que `radar_runtime` no puede alterar auditoría ni esquema.
4. Comprobar `/health` y `/ready`, logs, latencia y flujos principales en un entorno aislado.
5. Cambiar tráfico/DNS/secreto de conexión solo después de aprobación explícita y plan de reversión.

La restauración en una base distinta no copia roles globales del clúster, políticas del proveedor, secretos, reglas de red, certificados ni configuración de backups. Aprovisionar y verificar esos elementos por separado.

## Recuperación ante migración fallida

- La migración que falla hace ROLLBACK de su propia transacción.
- Las migraciones anteriores que ya hicieron COMMIT permanecen. No borrar filas de `schema_migrations` para forzar una repetición sobre una estructura parcialmente aplicada.
- Corregir el problema mediante una migración nueva y hacia adelante. No editar una migración ya aplicada en entornos compartidos.
- Si falla la fase final de grants, corregir permisos/rol y volver a ejecutar `npm run db:migrate`; el bloque de grants es transaccional y se puede repetir.
- Si el esquema/datos quedan en estado no recuperable, crear una base nueva, restaurar el último backup válido, aplicar migraciones compatibles y probar antes de cambiar tráfico.

## Política operativa pendiente

No se ha elegido aún el proveedor PostgreSQL ni el almacenamiento externo. Por tanto, el repositorio no puede afirmar que existan backups automáticos productivos.

Antes de aceptar datos reales, el propietario debe definir:

- **RPO:** cuánto dato se acepta perder como máximo (por ejemplo, 24 h si hay un backup diario; el valor real depende del negocio).
- **RTO:** cuánto tiempo máximo puede tardar la recuperación.
- Frecuencia, retención y cifrado de backups; región y control de acceso.
- Backups gestionados/PITR del proveedor, si están disponibles, y responsable de revisar alertas de fallo.
- Prueba periódica de restauración y evidencia de su duración y resultado.

La verificación CI demuestra que el procedimiento funciona en PostgreSQL 16 efímero. No demuestra que exista una copia externa, cifrado en reposo, recuperación PITR ni restauración en el proveedor final.


## TLS de la validación previa de restauración

La conexión PostgreSQL que verifica el rol y que la base destino esté vacía usa la misma intención TLS que la conexión CLI de `pg_restore`: `sslmode=require`, `verify-ca` o `verify-full` habilitan TLS con validación de certificado; `DB_SSL=true` fuerza TLS incluso si la URL contiene `sslmode=disable`. Los modos de downgrade `allow` y `prefer` se rechazan en esta validación. Si no se indica modo ni `DB_SSL=true`, se conserva la conexión sin TLS para desarrollo local. En producción se debe configurar TLS y certificados confiables según el proveedor.


## TLS consistente entre API, migraciones y utilidades PostgreSQL

La API, el runner de migraciones y la validación previa de restauración comparten la resolución de TLS: `DB_SSL=true` fuerza TLS; `sslmode=require`, `verify-ca` o `verify-full` en la URL activan TLS con verificación de certificado y nombre de host; `sslmode=disable` desactiva TLS salvo que `DB_SSL=true`. Las utilidades `pg_dump`/`pg_restore` convierten los modos TLS permitidos a `verify-full` para mantener el mismo nivel de verificación. Se rechazan los modos de downgrade `allow` y `prefer`. Si el proveedor usa una CA privada, indicar `sslrootcert` en la URL. En producción, validar la cadena y el nombre de host con el certificado real del proveedor.
