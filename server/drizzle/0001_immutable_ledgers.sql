-- Ledger and audit rows are append-only. Nobody — including administrators
-- using the application — can edit or delete them.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only and cannot be %d', TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER admin_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
--> statement-breakpoint
CREATE TRIGGER wallet_transactions_append_only
  BEFORE UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
