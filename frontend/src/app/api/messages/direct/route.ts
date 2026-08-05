import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;

    try {
        const body = await request.json();
        const targetUserId = body.targetUserId;
        const offerId = body.offerId || null;
        let title = body.title || null;

        if (!targetUserId) {
            return NextResponse.json(
                { error: 'ID de destinatario es requerido' },
                { status: 400 }
            );
        }

        const currentUserId = authUser.id;

        // Canonical ordering of participants
        const [p1, p2] = [currentUserId, targetUserId].sort();

        // 1. Check existing direct conversation
        const { data: existing } = await supabaseAdmin
            .from('conversations')
            .select('id, channel_type, title')
            .eq('participant1_id', p1)
            .eq('participant2_id', p2)
            .maybeSingle();

        if (existing) {
            // Ensure participants are registered in conversation_participants
            await supabaseAdmin
                .from('conversation_participants')
                .upsert(
                    [
                        { conversation_id: existing.id, user_id: p1, role: 'member' },
                        { conversation_id: existing.id, user_id: p2, role: 'member' },
                    ],
                    { onConflict: 'conversation_id,user_id' }
                );

            return NextResponse.json({
                success: true,
                conversationId: existing.id,
                isNew: false,
            });
        }

        // 2. Resolve title if not provided
        if (!title) {
            const { data: targetProfile } = await supabaseAdmin
                .from('user_profiles')
                .select('full_name')
                .eq('id', targetUserId)
                .maybeSingle();

            title = targetProfile?.full_name || 'Mensaje Directo';
        }

        // 3. Create new conversation
        const { data: created, error: createError } = await supabaseAdmin
            .from('conversations')
            .insert({
                participant1_id: p1,
                participant2_id: p2,
                channel_type: 'direct',
                title: title,
                offer_id: offerId,
                is_archived: false,
            })
            .select('id')
            .single();

        if (createError) {
            // Check if conflict occurred in race condition
            if (createError.code === '23505') {
                const { data: retry } = await supabaseAdmin
                    .from('conversations')
                    .select('id')
                    .eq('participant1_id', p1)
                    .eq('participant2_id', p2)
                    .single();

                if (retry) {
                    return NextResponse.json({
                        success: true,
                        conversationId: retry.id,
                        isNew: false,
                    });
                }
            }
            throw createError;
        }

        // 4. Insert participants
        await supabaseAdmin
            .from('conversation_participants')
            .insert([
                { conversation_id: created.id, user_id: p1, role: 'member' },
                { conversation_id: created.id, user_id: p2, role: 'member' },
            ]);

        return NextResponse.json({
            success: true,
            conversationId: created.id,
            isNew: true,
        });
    } catch (err: any) {
        console.error('[Direct Message API] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Error al iniciar conversación' },
            { status: 500 }
        );
    }
}
