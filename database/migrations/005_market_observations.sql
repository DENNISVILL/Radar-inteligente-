CREATE TABLE IF NOT EXISTS market_observations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id UUID NOT NULL,
 research_id UUID NOT NULL,
 competitor_id UUID,
 observation_type VARCHAR(24) NOT NULL CHECK (observation_type IN ('strength','weakness','promotion','customer_experience','strategy','opportunity','risk','other')),
 title VARCHAR(180) NOT NULL,
 content VARCHAR(3000) NOT NULL,
 source_name VARCHAR(180),
 source_url TEXT,
 observed_on DATE NOT NULL,
 confidence VARCHAR(12) NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
 recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (research_id,workspace_id) REFERENCES researches(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY (competitor_id,workspace_id) REFERENCES competitors(id,workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_market_observations_research_date ON market_observations(workspace_id,research_id,observed_on DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_observations_competitor ON market_observations(workspace_id,competitor_id,observed_on DESC);
