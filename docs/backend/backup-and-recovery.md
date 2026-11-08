# Respaldo y recuperación PostgreSQL

## Qué está implementado

- `npm run db:backup`: genera un archivo PostgreSQL en formato custom (`pg_dump`), no sobrescribe un archivo existente, limita permisos locales a propietario (`0600`) y comprueba que `pg_restore --list` pueda leer el archivo. La conexión se descompone en variables estándar de libpq y la contraseña se escribe temporalmente en un archivo `.pgpass` con permisos `0600`; el archivo se elimina al terminar, incluso si falla el comando. La contraseña no aparece en los argumentos del proceso ni en sus variables de entorno.
- `npm run db:restore`: verifica el archivo, exige que `RESTORE_CONFIRM_DATABASE` coincida exactamente con el nombre de la base destino, exige que la conexión sea el rol `radar_migration_owner`, exige que ese rol sea propietario de la base y rechaza destinos con tablas/vistas. Restaura en una sola transacción con `pg_restore --exit-on-error --single-transaction`; la contraseña también se entrega mediante un `.pgpass` temporal de permisos `0600`, eliminado al terminar.
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

El archivo debe guardarse en almacenamiento cifrado, con acceso restringido y fuera del servidor de la aplicación. El script no cifra ni programa la copia: esa parte debe configurarse en el proveedor de almacenamiento/backup o mediante un gestor de secretos y una tarea programada. No subir respaldos a Git ni enviarlos por correo/chat.

## Restaurar sin sobrescribir datos

**Nunca restaurar encima de la base activa.** Primero crea una base de recuperación nueva y vacía en el proveedor, asigna como propietario a `radar_migration_owner`, y usa la credencial de ese rol para restaurar. El rol debe poder crear objetos en el esquema destino.

Ejemplo:

```bash
export RESTORE_FILE='/ruta/segura/radar-2026-11-08.dump'
export RESTORE_DATABASE_URL='postgresql://radar_migration_owner:clave@host:5432/radar_recovery'
export RESTORE_CONFIRM_DATABASE='radar_recovery'
npm run db:restore
```

El nombre de confirmación debe coincidir exactamente con el nombre de la base destino. La herramienta se detiene si detecta tablas/vistas, si el rol no es el propietario esperado, si el archivo no se puede listar o si la restauración SQL falla. No se usa `--clean` ni `--if-exists`; por diseño no elimina objetos existentes.

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
