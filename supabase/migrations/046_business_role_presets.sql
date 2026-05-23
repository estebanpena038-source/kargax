-- Sprint 32: enterprise role presets for business teams and warehouse access.
-- Keeps legacy manager/operator values while enabling sharper B2B duties:
-- operations, dispatch, warehouse, accounting, audit and read-only.

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname
    INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.business_team_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
    ORDER BY conname
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.business_team_members DROP CONSTRAINT %I', constraint_name);
    END IF;

    ALTER TABLE public.business_team_members
        ADD CONSTRAINT business_team_members_role_check
        CHECK (
            role IN (
                'owner',
                'manager',
                'ops_manager',
                'dispatcher',
                'warehouse_manager',
                'warehouse_operator',
                'finance_accountant',
                'operator',
                'auditor',
                'viewer'
            )
        );
END $$;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname
    INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.warehouse_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
    ORDER BY conname
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.warehouse_members DROP CONSTRAINT %I', constraint_name);
    END IF;

    ALTER TABLE public.warehouse_members
        ADD CONSTRAINT warehouse_members_role_check
        CHECK (
            role IN (
                'manager',
                'ops_manager',
                'dispatcher',
                'warehouse_manager',
                'warehouse_operator',
                'finance_accountant',
                'operator',
                'auditor',
                'viewer'
            )
        );
END $$;

COMMENT ON COLUMN public.business_team_members.role IS
    'Business team role preset: owner, ops_manager, dispatcher, warehouse_manager, warehouse_operator, finance_accountant, auditor, viewer. Legacy manager/operator kept for compatibility.';

COMMENT ON COLUMN public.warehouse_members.role IS
    'Warehouse-scoped role derived from the business team role. Supports precise permissions without mixing finance, dispatch and warehouse duties.';

INSERT INTO public.feature_flags (key, enabled, description, updated_at)
VALUES
    (
        'advanced_business_roles_enabled',
        TRUE,
        'Enables granular company roles for operations, dispatch, warehouse, accounting, audit and viewer access.',
        NOW()
    )
ON CONFLICT (key) DO UPDATE
SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    updated_at = NOW();
