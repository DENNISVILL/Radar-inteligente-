CREATE TABLE IF NOT EXISTS market_reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL,
 research_id UUID NOT NULL,
 version INTEGER NOT NULL CHECK (version > 0),
 report_data JSONB NOT NULL,
 generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
 generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(workspace_id,research_id,version),
 UNIQUE(id,workspace_id,research_id),
 FOREIGN KEY(research_id,workspace_id) REFERENCES researches(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_market_reports_research_versions
 ON market_reports(workspace_id,research_id,version DESC);
