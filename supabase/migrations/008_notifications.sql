-- =============================================================================
-- KARGAX - NOTIFICATIONS SYSTEM
-- Enterprise-grade notification system with triggers
-- =============================================================================

-- =============================================================================
-- 1. NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'application_received',
        'application_accepted', 
        'application_rejected',
        'offer_published',
        'offer_expired',
        'new_message'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================================
-- 2. RLS POLICIES FOR NOTIFICATIONS
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- System can insert notifications for any user (via triggers)
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- =============================================================================
-- 3. HELPER FUNCTION: Create Notification
-- =============================================================================

CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (p_user_id, p_type, p_title, p_message, p_data)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

-- =============================================================================
-- 4. TRIGGER: Notify Business on New Application
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_trucker_name TEXT;
BEGIN
    -- Get offer details
    SELECT co.*, au.raw_user_meta_data->>'full_name' as trucker_name
    INTO v_offer
    FROM cargo_offers co
    LEFT JOIN auth.users au ON au.id = NEW.trucker_id
    WHERE co.id = NEW.offer_id;
    
    IF v_offer IS NULL THEN
        RETURN NEW;
    END IF;
    
    v_trucker_name := COALESCE(v_offer.trucker_name, 'Un transportador');
    
    -- Create notification for business owner
    PERFORM create_notification(
        v_offer.business_id,
        'application_received',
        'Nueva postulación recibida',
        v_trucker_name || ' se ha postulado para tu oferta de ' || v_offer.cargo_type,
        jsonb_build_object(
            'offer_id', NEW.offer_id,
            'application_id', NEW.id,
            'trucker_id', NEW.trucker_id
        )
    );
    
    -- Update applications count
    UPDATE cargo_offers 
    SET applications_count = applications_count + 1
    WHERE id = NEW.offer_id;
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_notify_new_application ON offer_applications;
CREATE TRIGGER trg_notify_new_application
    AFTER INSERT ON offer_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_new_application();

-- =============================================================================
-- 5. TRIGGER: Notify Trucker on Application Status Change
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_notification_type TEXT;
    v_title TEXT;
    v_message TEXT;
BEGIN
    -- Only trigger on status change from 'pending'
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get offer details
    SELECT * INTO v_offer FROM cargo_offers WHERE id = NEW.offer_id;
    
    IF v_offer IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Determine notification content based on new status
    IF NEW.status = 'accepted' THEN
        v_notification_type := 'application_accepted';
        v_title := '¡Felicidades! Tu postulación fue aceptada';
        v_message := 'Has sido seleccionado para el envío de ' || v_offer.cargo_type || 
                     ' desde ' || v_offer.origin_city || ' hasta ' || v_offer.destination_city;
    ELSIF NEW.status = 'rejected' THEN
        v_notification_type := 'application_rejected';
        v_title := 'Postulación no seleccionada';
        v_message := 'Tu postulación para el envío de ' || v_offer.cargo_type || 
                     ' no fue seleccionada esta vez. ¡Sigue intentando!';
    ELSE
        RETURN NEW;
    END IF;
    
    -- Create notification for trucker
    PERFORM create_notification(
        NEW.trucker_id,
        v_notification_type,
        v_title,
        v_message,
        jsonb_build_object(
            'offer_id', NEW.offer_id,
            'application_id', NEW.id,
            'status', NEW.status
        )
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_notify_application_status ON offer_applications;
CREATE TRIGGER trg_notify_application_status
    AFTER UPDATE ON offer_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_application_status_change();

-- =============================================================================
-- 6. TRIGGER: Decrement Application Count on Delete/Withdrawal
-- =============================================================================

CREATE OR REPLACE FUNCTION update_application_count_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE cargo_offers 
    SET applications_count = GREATEST(0, applications_count - 1)
    WHERE id = OLD.offer_id;
    
    RETURN OLD;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_count_on_delete ON offer_applications;
CREATE TRIGGER trg_update_count_on_delete
    AFTER DELETE ON offer_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_application_count_on_delete();

-- =============================================================================
-- 7. ENABLE REALTIME FOR NOTIFICATIONS
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================================
-- 8. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
