CREATE TABLE IF NOT EXISTS workspace_invitations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 email VARCHAR(254) NOT NULL,
 role VARCHAR(30) NOT NULL CHECK (role IN ('admin','analyst','viewer')),
 token_hash CHAR(64) NOT NULL UNIQUE,
 invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 accepted_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invitations_pending_email
 ON workspace_invitations(workspace_id,lower(email))
 WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_pending
 ON workspace_invitations(workspace_id,expires_at DESC)
 WHERE accepted_at IS NULL AND revoked_at IS NULL;
