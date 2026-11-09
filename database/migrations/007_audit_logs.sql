CREATE TABLE IF NOT EXISTS audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 event_type VARCHAR(120) NOT NULL,
 resource_type VARCHAR(80) NOT NULL,
 resource_id UUID,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created
 ON audit_logs(workspace_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
 ON audit_logs(workspace_id,resource_type,resource_id);
