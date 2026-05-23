-- =============================================================================
-- ADMIN NOTIFICATIONS TABLE
-- For withdrawal requests and other admin alerts
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread 
ON admin_notifications(read, created_at DESC) 
WHERE read = FALSE;

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type 
ON admin_notifications(type, created_at DESC);

-- RLS: Only admins can access
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for admin users
CREATE POLICY "Admins can manage notifications"
ON admin_notifications
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_type = 'admin'
    )
);

-- =============================================================================
-- SAVED PAYMENT METHODS TABLE
-- For storing reusable payment methods per user
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('nequi', 'savings', 'checking')),
    bank_name VARCHAR(100),
    account_number VARCHAR(50) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per user and account
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_unique 
ON payment_methods(user_id, method_type, account_number);

-- Index by user
CREATE INDEX IF NOT EXISTS idx_payment_methods_user 
ON payment_methods(user_id, is_default DESC);

-- RLS: Users can only see their own payment methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payment methods"
ON payment_methods
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- ADD STATUS TO TRANSACTIONS (if not exists)
-- =============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'status'
    ) THEN
        ALTER TABLE transactions ADD COLUMN status VARCHAR(20) DEFAULT 'completed';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE transactions ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- Index for pending withdrawals
CREATE INDEX IF NOT EXISTS idx_transactions_pending_withdrawals 
ON transactions(status, type, created_at DESC) 
WHERE status = 'pending' AND type = 'withdrawal';
