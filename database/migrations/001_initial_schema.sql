CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS workspaces (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(120) NOT NULL, slug VARCHAR(140) NOT NULL UNIQUE,
 status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- auth_subject permite enlazar Supabase Auth sin acoplar el dominio al proveedor.
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), auth_subject VARCHAR(255) UNIQUE,
 email VARCHAR(254) NOT NULL UNIQUE, display_name VARCHAR(120),
 status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workspace_members (
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role VARCHAR(30) NOT NULL CHECK (role IN ('owner','admin','analyst','viewer')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS researches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(120) NOT NULL,
 country VARCHAR(80) NOT NULL, city VARCHAR(100), sector VARCHAR(100) NOT NULL, objective VARCHAR(1000) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_researches_workspace_created ON researches(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_researches_updated_at ON researches;
CREATE TRIGGER trg_researches_updated_at BEFORE UPDATE ON researches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
