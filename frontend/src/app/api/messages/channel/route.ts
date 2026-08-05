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
        const { channelType, entityType, entityId, title, participantIds } = body;

        const currentUserId = authUser.id;

        // 1. If entityId is provided (e.g. for a trip channel), check if channel already exists
        if (entityType && entityId) {
            const { data: existing } = await supabaseAdmin
                .from('conversations')
                .select('id')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .maybeSingle();

            if (existing) {
                // Ensure current user is in participants
                await supabaseAdmin
                    .from('conversation_participants')
                    .upsert({
                        conversation_id: existing.id,
                        user_id: currentUserId,
                        role: 'member',
                    }, { onConflict: 'conversation_id,user_id' });

                return NextResponse.json({
                    success: true,
                    channelId: existing.id,
                    isNew: false,
                });
            }
        }

        // 2. If it's a named channel like #general or #novedades-flota for a business, check if it already exists
        if (title && (channelType === 'fleet' || channelType === 'general')) {
            const { data: existingTitle } = await supabaseAdmin
                .from('conversations')
                .select('id')
                .eq('business_id', currentUserId)
                .eq('title', title)
                .maybeSingle();

            if (existingTitle) {
                await supabaseAdmin
                    .from('conversation_participants')
                    .upsert({
                        conversation_id: existingTitle.id,
                        user_id: currentUserId,
                        role: 'admin',
                    }, { onConflict: 'conversation_id,user_id' });

                return NextResponse.json({
                    success: true,
                    channelId: existingTitle.id,
                    isNew: false,
                });
            }
        }

        // 3. Create the channel conversation
        const { data: created, error: createError } = await supabaseAdmin
            .from('conversations')
            .insert({
                channel_type: channelType || 'fleet',
                entity_type: entityType || null,
                entity_id: entityId || null,
                title: title || '#canal',
                business_id: currentUserId,
                is_archived: false,
            })
            .select('id')
            .single();

        if (createError) {
            throw createError;
        }

        // 4. Add creator as admin participant
        const participantsToInsert = [
            {
                conversation_id: created.id,
                user_id: currentUserId,
                role: 'admin',
            },
        ];

        // Add additional participants if specified
        if (Array.isArray(participantIds)) {
            for (const pid of participantIds) {
                if (pid && pid !== currentUserId) {
                    participantsToInsert.push({
                        conversation_id: created.id,
                        user_id: pid,
                        role: 'member',
                    });
                }
            }
        }

        // If it's a trip channel, also add the assigned trucker or business
        if (entityType === 'trip' && entityId) {
            const { data: offer } = await supabaseAdmin
                .from('cargo_offers')
                .select('business_id, assigned_trucker_id, private_fleet_trucker_id')
                .eq('id', entityId)
                .maybeSingle();

            if (offer) {
                const truckerId = offer.assigned_trucker_id || offer.private_fleet_trucker_id;
                if (truckerId && truckerId !== currentUserId) {
                    participantsToInsert.push({
                        conversation_id: created.id,
                        user_id: truckerId,
                        role: 'member',
                    });
                }
                if (offer.business_id && offer.business_id !== currentUserId) {
                    participantsToInsert.push({
                        conversation_id: created.id,
                        user_id: offer.business_id,
                        role: 'admin',
                    });
                }
            }
        }

        await supabaseAdmin
            .from('conversation_participants')
            .upsert(participantsToInsert, { onConflict: 'conversation_id,user_id' });

        return NextResponse.json({
            success: true,
            channelId: created.id,
            isNew: true,
        });
    } catch (err: any) {
        console.error('[Channel API] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Error al crear canal' },
            { status: 500 }
        );
    }
}
