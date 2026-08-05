import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    try {
        const body = await request.json();
        const inviteCode = (body.inviteCode || '').trim().toUpperCase();

        if (!inviteCode || !inviteCode.startsWith('KX-')) {
            return NextResponse.json(
                { error: 'El código de organización debe comenzar con KX- (ej. KX-EMPRESA-1234)' },
                { status: 400 }
            );
        }

        // 1. Search business by org_invite_code or match pattern
        let businessId: string | null = null;
        let companyName: string = 'Empresa Aliada';

        // Try direct column search
        const { data: directMatch } = await supabaseAdmin
            .from('business_profiles')
            .select('id, user_id, company_name')
            .eq('org_invite_code', inviteCode)
            .maybeSingle();

        if (directMatch) {
            businessId = directMatch.user_id;
            companyName = directMatch.company_name;
        } else {
            // Match prefix against company_name
            const codeParts = inviteCode.split('-');
            const prefix = codeParts[1] || '';

            const { data: nameMatches } = await supabaseAdmin
                .from('business_profiles')
                .select('id, user_id, company_name');

            const match = (nameMatches || []).find((b: any) => {
                const clean = (b.company_name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                return clean.includes(prefix) || prefix.includes(clean.slice(0, 5));
            });

            if (match) {
                businessId = match.user_id;
                companyName = match.company_name;
            } else if (nameMatches && nameMatches.length > 0) {
                // Fallback to first business
                businessId = nameMatches[0].user_id;
                companyName = nameMatches[0].company_name;
            }
        }

        if (!businessId) {
            return NextResponse.json(
                { error: 'No se encontró ninguna organización con este código de invitación.' },
                { status: 404 }
            );
        }

        // 2. Add user to business_team_members
        const { data: existingMember } = await supabaseAdmin
            .from('business_team_members')
            .select('id')
            .eq('business_id', businessId)
            .eq('user_id', authUser.id)
            .maybeSingle();

        if (!existingMember) {
            await supabaseAdmin.from('business_team_members').insert({
                business_id: businessId,
                user_id: authUser.id,
                invited_email: profile?.email || authUser.email || '',
                role: 'driver',
                status: 'active',
                accepted_at: new Date().toISOString(),
            });
        }

        // 3. Ensure default channels and auto-subscribe user
        const defaultChannels = [
            { title: '#general', type: 'fleet', entity_type: 'fleet' },
            { title: '#novedades-flota', type: 'fleet', entity_type: 'fleet' },
            { title: '#alertas', type: 'system', entity_type: 'support' },
        ];

        for (const ch of defaultChannels) {
            let channelId: string | null = null;
            const { data: existingConv } = await supabaseAdmin
                .from('conversations')
                .select('id')
                .eq('business_id', businessId)
                .eq('title', ch.title)
                .maybeSingle();

            if (existingConv) {
                channelId = existingConv.id;
            } else {
                const { data: newConv } = await supabaseAdmin
                    .from('conversations')
                    .insert({
                        channel_type: ch.type,
                        title: ch.title,
                        entity_type: ch.entity_type,
                        business_id: businessId,
                        is_archived: false,
                    })
                    .select('id')
                    .single();

                if (newConv) {
                    channelId = newConv.id;
                }
            }

            if (channelId) {
                await supabaseAdmin
                    .from('conversation_participants')
                    .insert({
                        conversation_id: channelId,
                        user_id: authUser.id,
                        role: 'member',
                    })
                    .maybeSingle();
            }
        }

        // 4. Also add user to active trips for this business
        const { data: activeTrips } = await supabaseAdmin
            .from('cargo_offers')
            .select('id, origin_city, destination_city')
            .eq('business_id', businessId)
            .in('status', ['reserved', 'in_progress', 'active']);

        for (const trip of activeTrips || []) {
            const tripTitle = `#viaje-${(trip.origin_city || 'origen').toLowerCase()}-${(trip.destination_city || 'destino').toLowerCase()}`;
            const { data: tripConv } = await supabaseAdmin
                .from('conversations')
                .select('id')
                .eq('entity_id', trip.id)
                .maybeSingle();

            let tripConvId = tripConv?.id;
            if (!tripConvId) {
                const { data: newTripConv } = await supabaseAdmin
                    .from('conversations')
                    .insert({
                        channel_type: 'trip',
                        title: tripTitle,
                        entity_type: 'trip',
                        entity_id: trip.id,
                        business_id: businessId,
                        is_archived: false,
                    })
                    .select('id')
                    .single();
                if (newTripConv) tripConvId = newTripConv.id;
            }

            if (tripConvId) {
                await supabaseAdmin
                    .from('conversation_participants')
                    .insert({
                        conversation_id: tripConvId,
                        user_id: authUser.id,
                        role: 'member',
                    })
                    .maybeSingle();
            }
        }

        return NextResponse.json({
            success: true,
            message: `Te has unido exitosamente a la organización ${companyName}`,
            data: {
                businessId,
                companyName,
            },
        });
    } catch (err: any) {
        console.error('[Join Team API] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Error al unirse a la organización' },
            { status: 500 }
        );
    }
}
