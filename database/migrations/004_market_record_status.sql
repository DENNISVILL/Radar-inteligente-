ALTER TABLE competitors ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE competitors DROP CONSTRAINT IF EXISTS competitors_status_check;
ALTER TABLE competitors ADD CONSTRAINT competitors_status_check CHECK(status IN ('active','archived'));
ALTER TABLE market_products ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE market_products DROP CONSTRAINT IF EXISTS market_products_status_check;
ALTER TABLE market_products ADD CONSTRAINT market_products_status_check CHECK(status IN ('active','archived'));
CREATE INDEX IF NOT EXISTS idx_competitors_status ON competitors(workspace_id,status,name);
CREATE INDEX IF NOT EXISTS idx_market_products_status ON market_products(workspace_id,status,name);
