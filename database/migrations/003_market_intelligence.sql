CREATE UNIQUE INDEX IF NOT EXISTS idx_researches_id_workspace_unique ON researches(id,workspace_id);
CREATE TABLE IF NOT EXISTS competitors (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name VARCHAR(160) NOT NULL, website_url TEXT, location VARCHAR(180), description VARCHAR(1000),
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(id,workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_competitors_workspace ON competitors(workspace_id,name);
CREATE TABLE IF NOT EXISTS market_products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 competitor_id UUID, research_id UUID, name VARCHAR(160) NOT NULL, category VARCHAR(120), description VARCHAR(1000), product_url TEXT,
 created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(id,workspace_id),
 FOREIGN KEY(competitor_id,workspace_id) REFERENCES competitors(id,workspace_id),
 FOREIGN KEY(research_id,workspace_id) REFERENCES researches(id,workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_market_products_workspace ON market_products(workspace_id,name);
CREATE TABLE IF NOT EXISTS price_observations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL, product_id UUID NOT NULL,
 price NUMERIC(14,2) NOT NULL CHECK(price>=0), currency CHAR(3) NOT NULL DEFAULT 'USD', observed_on DATE NOT NULL,
 source_name VARCHAR(160), source_url TEXT, notes VARCHAR(1000), recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY(product_id,workspace_id) REFERENCES market_products(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_price_observations_history ON price_observations(workspace_id,product_id,observed_on DESC);
DROP TRIGGER IF EXISTS trg_competitors_updated_at ON competitors;
CREATE TRIGGER trg_competitors_updated_at BEFORE UPDATE ON competitors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_market_products_updated_at ON market_products;
CREATE TRIGGER trg_market_products_updated_at BEFORE UPDATE ON market_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
