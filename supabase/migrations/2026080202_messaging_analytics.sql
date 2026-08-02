-- =============================================================================
-- KARGAX - SUPABASE MIGRATION 051: MESSAGING ANALYTICS
-- Vistas analíticas de mensajería para el CEO dashboard
-- =============================================================================

-- =============================================================================
-- PLAN DE ROLLBACK CONCEPTUAL
-- 1. DROP VIEW IF EXISTS public.messaging_activity_daily;
-- 2. DROP VIEW IF EXISTS public.avg_response_time_by_channel;
-- 3. DROP VIEW IF EXISTS public.unread_alerts;
-- =============================================================================

-- =============================================================================
-- 1. VIEW: messaging_activity_daily
-- =============================================================================
CREATE OR REPLACE VIEW public.messaging_activity_daily AS
SELECT 
    DATE(m.created_at) AS activity_date,
    c.business_id,
    COUNT(m.id) AS total_messages,
    COUNT(DISTINCT m.sender_id) AS active_users
FROM public.messages m
JOIN public.conversations c ON m.conversation_id = c.id
WHERE c.business_id IS NOT NULL
GROUP BY DATE(m.created_at), c.business_id
ORDER BY activity_date DESC;

-- =============================================================================
-- 2. VIEW: avg_response_time_by_channel
-- =============================================================================
-- Calcula el tiempo promedio (en minutos) entre el primer mensaje de una conversación 
-- y el primer mensaje de un remitente diferente
CREATE OR REPLACE VIEW public.avg_response_time_by_channel AS
WITH first_messages AS (
    SELECT 
        conversation_id,
        MIN(created_at) AS first_msg_time,
        (array_agg(sender_id ORDER BY created_at ASC))[1] AS first_sender_id
    FROM public.messages
    GROUP BY conversation_id
),
first_responses AS (
    SELECT 
        m.conversation_id,
        MIN(m.created_at) AS response_time
    FROM public.messages m
    JOIN first_messages fm ON m.conversation_id = fm.conversation_id
    WHERE m.sender_id != fm.first_sender_id OR m.sender_id IS NULL
    GROUP BY m.conversation_id
)
SELECT 
    c.channel_type,
    AVG(EXTRACT(EPOCH FROM (fr.response_time - fm.first_msg_time))/60)::NUMERIC(10,2) AS avg_response_minutes,
    COUNT(fr.conversation_id) AS responses_analyzed
FROM public.conversations c
JOIN first_messages fm ON c.id = fm.conversation_id
JOIN first_responses fr ON c.id = fr.conversation_id
GROUP BY c.channel_type;

-- =============================================================================
-- 3. VIEW: unread_alerts
-- =============================================================================
-- Canales con mensajes no leídos por más de 1 hora
CREATE OR REPLACE VIEW public.unread_alerts AS
SELECT 
    cp.conversation_id,
    c.title AS channel_title,
    c.channel_type,
    c.business_id,
    cp.user_id,
    cp.unread_count,
    MAX(m.created_at) AS last_message_time,
    EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at)))/3600 AS hours_unread
FROM public.conversation_participants cp
JOIN public.conversations c ON cp.conversation_id = c.id
JOIN public.messages m ON c.id = m.conversation_id
WHERE cp.unread_count > 0
GROUP BY cp.conversation_id, c.title, c.channel_type, c.business_id, cp.user_id, cp.unread_count
HAVING EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at)))/3600 >= 1;

-- =============================================================================
-- 4. GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON public.messaging_activity_daily TO authenticated;
GRANT SELECT ON public.avg_response_time_by_channel TO authenticated;
GRANT SELECT ON public.unread_alerts TO authenticated;
