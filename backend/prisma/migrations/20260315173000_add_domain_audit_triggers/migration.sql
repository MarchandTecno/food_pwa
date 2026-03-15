-- Add trigger-based audit logging for inventory, cash and coupon domains.
-- This captures writes performed by any client, not only GraphQL resolvers.

CREATE OR REPLACE FUNCTION core.audit_log_domain_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_action VARCHAR(20);
  v_entity VARCHAR(50);
  v_record_id UUID;
  v_tenant_id UUID;
  v_user_id UUID;
  v_previous JSONB;
  v_current JSONB;
  v_session_id UUID;
BEGIN
  v_entity := TG_TABLE_NAME;

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_previous := to_jsonb(OLD);
  ELSE
    v_record_id := NEW.id;
    v_current := to_jsonb(NEW);
  END IF;

  IF TG_TABLE_NAME = 'inventory_adjustments' THEN
    v_entity := 'inventory_adjustments';
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'INVENTORY_CREATE'
      WHEN 'UPDATE' THEN 'INVENTORY_UPDATE'
      ELSE 'INVENTORY_DELETE'
    END;

    IF TG_OP = 'DELETE' THEN
      v_user_id := OLD.user_id;
      SELECT i.tenant_id INTO v_tenant_id
      FROM public.ingredients AS i
      WHERE i.id = OLD.ingredient_id;
    ELSE
      v_user_id := NEW.user_id;
      SELECT i.tenant_id INTO v_tenant_id
      FROM public.ingredients AS i
      WHERE i.id = NEW.ingredient_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'coupons' THEN
    v_entity := 'coupons';
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'COUPON_CREATE'
      WHEN 'UPDATE' THEN 'COUPON_UPDATE'
      ELSE 'COUPON_DELETE'
    END;

    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'cash_sessions' THEN
    v_entity := 'cash_sessions';
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'CASH_SES_CREATE'
      WHEN 'UPDATE' THEN 'CASH_SES_UPDATE'
      ELSE 'CASH_SES_DELETE'
    END;

    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
      v_user_id := OLD.user_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
      v_user_id := NEW.user_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    v_entity := 'cash_movements';
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'CASH_MOV_CREATE'
      WHEN 'UPDATE' THEN 'CASH_MOV_UPDATE'
      ELSE 'CASH_MOV_DELETE'
    END;

    IF TG_OP = 'DELETE' THEN
      v_session_id := OLD.session_id;
    ELSE
      v_session_id := NEW.session_id;
    END IF;

    IF v_session_id IS NOT NULL THEN
      IF TG_TABLE_SCHEMA = 'core' THEN
        SELECT s.tenant_id, s.user_id INTO v_tenant_id, v_user_id
        FROM core.cash_sessions AS s
        WHERE s.id = v_session_id;
      ELSE
        SELECT s.tenant_id, s.user_id INTO v_tenant_id, v_user_id
        FROM public.cash_sessions AS s
        WHERE s.id = v_session_id;
      END IF;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO core.audit_logs (
    tenant_id,
    user_id,
    accion,
    tabla_afectada,
    registro_id,
    valor_anterior,
    valor_nuevo,
    ip_address
  )
  VALUES (
    v_tenant_id,
    v_user_id,
    LEFT(v_action, 20),
    LEFT(v_entity, 50),
    v_record_id,
    v_previous,
    v_current,
    NULL
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inventory_adjustments ON public.inventory_adjustments;
CREATE TRIGGER trg_audit_inventory_adjustments
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();

DROP TRIGGER IF EXISTS trg_audit_core_coupons ON core.coupons;
CREATE TRIGGER trg_audit_core_coupons
AFTER INSERT OR UPDATE OR DELETE ON core.coupons
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();

DROP TRIGGER IF EXISTS trg_audit_core_cash_sessions ON core.cash_sessions;
CREATE TRIGGER trg_audit_core_cash_sessions
AFTER INSERT OR UPDATE OR DELETE ON core.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();

DROP TRIGGER IF EXISTS trg_audit_core_cash_movements ON core.cash_movements;
CREATE TRIGGER trg_audit_core_cash_movements
AFTER INSERT OR UPDATE OR DELETE ON core.cash_movements
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();

DROP TRIGGER IF EXISTS trg_audit_public_cash_sessions ON public.cash_sessions;
CREATE TRIGGER trg_audit_public_cash_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();

DROP TRIGGER IF EXISTS trg_audit_public_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_audit_public_cash_movements
AFTER INSERT OR UPDATE OR DELETE ON public.cash_movements
FOR EACH ROW
EXECUTE FUNCTION core.audit_log_domain_changes();
