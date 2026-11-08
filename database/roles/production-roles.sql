-- Bootstrap de roles para una base PostgreSQL NUEVA.
-- Ejecutar una sola vez como administrador de la base:
-- psql "$ADMIN_DATABASE_URL" -v database_name=radar_comercial \
--   -v migration_password='...' -v runtime_password='...' -f database/roles/production-roles.sql
-- No guardar contraseñas reales en el repositorio, shell history ni archivos compartidos.
\set ON_ERROR_STOP on

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

-- Privilegios DML mínimos sobre las tablas de la aplicación existentes.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radar_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radar_runtime;

-- El runtime puede generar eventos, pero no leerlos ni reescribirlos/borrarlos.
REVOKE ALL ON TABLE audit_logs FROM radar_runtime;
GRANT INSERT ON TABLE audit_logs TO radar_runtime;

-- La API nunca administra el historial de migraciones.
REVOKE ALL ON TABLE schema_migrations FROM radar_runtime;

-- Los objetos futuros creados por radar_migration_owner heredan permisos DML
-- para runtime; aplicar excepciones explícitas a tablas sensibles en cada migración.
ALTER DEFAULT PRIVILEGES FOR ROLE radar_migration_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO radar_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE radar_migration_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO radar_runtime;

-- Defensa adicional: runtime no debe heredar privilegios peligrosos.
REVOKE CREATE ON SCHEMA public FROM radar_runtime;
