-- SHA-256 integrity fingerprint for each immutable report snapshot.
ALTER TABLE market_reports ADD COLUMN IF NOT EXISTS report_hash CHAR(64);
UPDATE market_reports
 SET report_hash=encode(digest(report_data::text,'sha256'),'hex')
 WHERE report_hash IS NULL;
ALTER TABLE market_reports ALTER COLUMN report_hash SET NOT NULL;
ALTER TABLE market_reports DROP CONSTRAINT IF EXISTS market_reports_report_hash_check;
ALTER TABLE market_reports ADD CONSTRAINT market_reports_report_hash_check
 CHECK(report_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION set_market_report_hash() RETURNS TRIGGER AS $$
BEGIN
 NEW.report_hash := encode(digest(NEW.report_data::text,'sha256'),'hex');
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_market_report_update() RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'Market report snapshots are immutable.'
  USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_reports_hash ON market_reports;
CREATE TRIGGER trg_market_reports_hash
 BEFORE INSERT ON market_reports
 FOR EACH ROW EXECUTE FUNCTION set_market_report_hash();

DROP TRIGGER IF EXISTS trg_market_reports_immutable ON market_reports;
CREATE TRIGGER trg_market_reports_immutable
 BEFORE UPDATE ON market_reports
 FOR EACH ROW EXECUTE FUNCTION prevent_market_report_update();
