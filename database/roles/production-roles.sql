-- Bootstrap de roles para una base PostgreSQL NUEVA.
-- Ejecutar una sola vez como administrador de la base:
-- En Bash, introducir secretos sin escribirlos en el historial:
-- read -s -p "Migration password: " MIGRATION_DB_PASSWORD; export MIGRATION_DB_PASSWORD; echo
-- read -s -p "Runtime password: " RUNTIME_DB_PASSWORD; export RUNTIME_DB_PASSWORD; echo
-- psql "$ADMIN_DATABASE_URL" -v database_name=radar_comercial -f database/roles/production-roles.sql
-- No guardar contraseñas reales en el repositorio ni archivos compartidos.
\set ON_ERROR_STOP on
\getenv migration_password MIGRATION_DB_PASSWORD
\getenv runtime_password RUNTIME_DB_PASSWORD

SELECT format('CREATE ROLE radar_migration_owner LOGIN PASSWORD %L', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radar_migration_owner') \gexec
SELECT format('ALTER ROLE radar_migration_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'migration_password') \gexec

SELECT format('CREATE ROLE radar_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radar_runtime') \gexec
SELECT format('ALTER ROLE radar_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'runtime_password') \gexec

GRANT CONNECT ON DATABASE :"database_name" TO radar_migration_owner, radar_runtime;

-- Solo el propietario de migraciones puede crear/alterar objetos del esquema.
GRANT USAGE, CREATE ON SCHEMA public TO radar_migration_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO radar_runtime;

-- Los grants sobre tablas existentes y las excepciones para auditoría se
-- aplican automáticamente al terminar npm run db:migrate.
-- Los objetos futuros creados por radar_migration_owner heredan permisos DML
-- para runtime; aplicar excepciones explícitas a tablas sensibles en cada migración.
ALTER DEFAULT PRIVILEGES FOR ROLE radar_migration_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO radar_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE radar_migration_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO radar_runtime;

-- Defensa adicional: runtime no debe heredar privilegios peligrosos.
REVOKE CREATE ON SCHEMA public FROM radar_runtime;
