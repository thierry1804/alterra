-- Defense-in-depth audit triggers on sensitive tables.
-- Application-level audit (Prisma extension) remains the primary source with userId/ip.

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER AS $$
DECLARE
  entity_id TEXT;
  old_json JSONB;
  new_json JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    entity_id := NEW."id"::TEXT;
    new_json := to_jsonb(NEW);
    INSERT INTO "AuditLog" ("action", "entityType", "entityId", "after", "createdAt")
    VALUES ('CREATE', TG_TABLE_NAME, entity_id, new_json, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    entity_id := NEW."id"::TEXT;
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    INSERT INTO "AuditLog" ("action", "entityType", "entityId", "before", "after", "createdAt")
    VALUES ('UPDATE', TG_TABLE_NAME, entity_id, old_json, new_json, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    entity_id := OLD."id"::TEXT;
    old_json := to_jsonb(OLD);
    INSERT INTO "AuditLog" ("action", "entityType", "entityId", "before", "createdAt")
    VALUES ('DELETE', TG_TABLE_NAME, entity_id, old_json, NOW());
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_worker_changes ON "Worker";
CREATE TRIGGER audit_worker_changes
  AFTER INSERT OR UPDATE OR DELETE ON "Worker"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_pointage_changes ON "Pointage";
CREATE TRIGGER audit_pointage_changes
  AFTER INSERT OR UPDATE OR DELETE ON "Pointage"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_payment_changes ON "Payment";
CREATE TRIGGER audit_payment_changes
  AFTER INSERT OR UPDATE OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
