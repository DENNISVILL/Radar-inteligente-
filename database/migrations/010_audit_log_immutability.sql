-- Preserve audit history when a workspace or actor is removed.
-- Direct UPDATE/DELETE/TRUNCATE is forbidden; FK-driven SET NULL updates are allowed.
ALTER TABLE audit_logs ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_workspace_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_workspace_id_fkey
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN
  -- Referential actions (ON DELETE SET NULL) may detach historical references.
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'audit log records are immutable; % is not permitted', TG_OP
  USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
 BEFORE UPDATE OR DELETE ON audit_logs
 FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_log_truncate() RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'audit log records are immutable; TRUNCATE is not permitted'
  USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
 BEFORE TRUNCATE ON audit_logs
 FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();
