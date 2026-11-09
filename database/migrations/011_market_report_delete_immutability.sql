-- Prevent direct deletion of immutable report snapshots.
-- Cascading deletion from a parent research/workspace remains available.
CREATE OR REPLACE FUNCTION prevent_market_report_delete() RETURNS TRIGGER AS $$
BEGIN
 IF pg_trigger_depth() > 1 THEN
  RETURN OLD;
 END IF;
 RAISE EXCEPTION 'Market report snapshots are immutable; DELETE is not permitted.'
  USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_reports_immutable_delete ON market_reports;
CREATE TRIGGER trg_market_reports_immutable_delete
 BEFORE DELETE ON market_reports
 FOR EACH ROW EXECUTE FUNCTION prevent_market_report_delete();
