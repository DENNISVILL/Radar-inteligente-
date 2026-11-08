# Roles PostgreSQL: runtime y migraciones

## Objetivo

Radar utiliza dos credenciales distintas:

- `DATABASE_URL`: conexión de la API. Corresponde a `radar_runtime`.
- `MIGRATION_DATABASE_URL`: conexión exclusiva del proceso `npm run db:migrate`. Corresponde a `radar_migration_owner`.

En producción, el comando de migraciones falla si no se define `MIGRATION_DATABASE_URL`; no reutiliza accidentalmente la credencial de la API. En desarrollo local se permite el fallback a `DATABASE_URL` por comodidad.

## Aprovisionamiento inicial

Este procedimiento está pensado para una base PostgreSQL nueva y vacía, antes de ejecutar la primera migración. Los proveedores administrados pueden reservar el esquema `public` o limitar la creación de roles; en ese caso, adaptar el procedimiento con el administrador del proveedor.

1. Crear la base de datos desde el panel/proveedor.
2. Ejecutar `database/roles/production-roles.sql` una sola vez, conectado a esa base como administrador. El script crea dos roles sin superusuario ni permisos para crear bases o roles ni omitir RLS (`NOBYPASSRLS`). También revoca explícitamente `CREATE` sobre la base al rol runtime y a `PUBLIC`; solo el rol de migraciones recibe `CREATE` para instalar extensiones y gestionar el esquema. Las contraseñas se leen de las variables de entorno `MIGRATION_DB_PASSWORD` y `RUNTIME_DB_PASSWORD`; no se guardan en Git.
3. Configurar `MIGRATION_DATABASE_URL` con el usuario `radar_migration_owner` y `DATABASE_URL` con `radar_runtime`. Activar `DB_SSL=true` cuando el proveedor exija TLS, o configurar `sslmode=verify-full` y `sslrootcert` en la URL según el certificado del proveedor. Los modos `allow` y `prefer` se rechazan.
4. Ejecutar `npm run db:migrate` usando la credencial de migraciones.
5. Arrancar la API únicamente con `DATABASE_URL`; no inyectar `MIGRATION_DATABASE_URL` en el servicio web.

El usuario administrador usado para el aprovisionamiento no debe utilizarse en la API.

## Permisos aplicados

El rol `radar_migration_owner` tiene `CREATE` en la base únicamente para poder instalar extensiones requeridas por el esquema inicial (como `pgcrypto`) y crear objetos durante despliegues. Esta credencial no se usa en el servidor API.\n\nEl ejecutor de migraciones, al terminar, aplica al rol `radar_runtime`:

- SELECT, INSERT, UPDATE y DELETE sobre tablas operativas.
- USAGE/SELECT sobre secuencias.
- Solo INSERT sobre `audit_logs`; no puede leer, actualizar, borrar ni truncar el historial.
- Ningún permiso sobre `schema_migrations`.
- Ningún permiso CREATE sobre el esquema `public` ni sobre la base de datos.
- Atributos de rol `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION` y `NOBYPASSRLS`.

El script de aprovisionamiento configura privilegios por defecto para tablas y secuencias futuras creadas por `radar_migration_owner`. La rutina de migración vuelve a aplicar los grants operativos y las excepciones de auditoría tras cada ejecución. Al añadir tablas sensibles nuevas, revisar expresamente sus grants.

## Verificación

La prueba PostgreSQL de integración crea temporalmente el rol `radar_runtime`, ejecuta el runner y consulta `has_table_privilege` / `has_schema_privilege`. Comprueba que el runtime puede operar sobre tablas de negocio, pero no leer ni modificar auditoría, no truncarla, no leer el historial de migraciones y no crear objetos.

## Bases ya existentes

No ejecutar el bootstrap de base nueva a ciegas en una base con datos. Antes de adoptar estos roles en una base existente, inventariar propietarios de tablas, secuencias, funciones y esquema; acordar un cambio de propietario controlado y probarlo en una copia restaurada. La migración runner debe conectarse como propietario de los objetos que vaya a modificar. No usar `REASSIGN OWNED` indiscriminadamente en un proveedor compartido.

## Límites y operación

- Los roles SQL no sustituyen TLS, red privada, rotación de secretos, backups ni restauraciones probadas.
- El propietario de migraciones puede alterar estructura y datos; sus credenciales deben estar disponibles solo durante despliegues/migraciones, no en el proceso web.
- El propietario/superusuario administrado por el proveedor puede cambiar triggers y permisos. Separar credenciales administrativas y restringir su acceso.
- No incluir contraseñas en `.env.example`, commits, logs, capturas ni mensajes.
