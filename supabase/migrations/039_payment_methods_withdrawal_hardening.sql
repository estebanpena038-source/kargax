-- =============================================================================
-- PAYMENT METHODS HARDENING FOR WITHDRAWALS
-- Ensures the upsert target exists in staging and removes duplicate rows that
-- can break wallet withdrawal requests.
-- =============================================================================

BEGIN;

UPDATE payment_methods
SET
    account_number = btrim(account_number),
    bank_name = NULLIF(btrim(COALESCE(bank_name, '')), ''),
    account_holder_name = btrim(account_holder_name),
    document_type = NULLIF(btrim(COALESCE(document_type, '')), ''),
    document_number = NULLIF(btrim(COALESCE(document_number, '')), ''),
    updated_at = NOW()
WHERE TRUE;

WITH ranked_methods AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, method_type, account_number
            ORDER BY is_default DESC, updated_at DESC, created_at DESC, id DESC
        ) AS row_rank
    FROM payment_methods
)
DELETE FROM payment_methods pm
USING ranked_methods rm
WHERE pm.id = rm.id
  AND rm.row_rank > 1;

DROP INDEX IF EXISTS idx_payment_methods_unique;

CREATE UNIQUE INDEX idx_payment_methods_unique
ON payment_methods(user_id, method_type, account_number);

WITH ranked_defaults AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY is_default DESC, updated_at DESC, created_at DESC, id DESC
        ) AS row_rank
    FROM payment_methods
    WHERE is_default = TRUE
)
UPDATE payment_methods pm
SET is_default = FALSE,
    updated_at = NOW()
FROM ranked_defaults rd
WHERE pm.id = rd.id
  AND rd.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_single_default
ON payment_methods(user_id)
WHERE is_default = TRUE;

COMMIT;
