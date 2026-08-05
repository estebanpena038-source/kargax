import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

function generateOrgCode(companyName?: string | null): string {
    const cleanPrefix = (companyName || 'KARGAX')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 8);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    return `KX-${cleanPrefix || 'EMPRESA'}-${randomSuffix}`;
}

export async function GET(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;

    try {
        // 1. Check if user is owner of a business_profile
        let { data: businessProfile } = await supabaseAdmin
            .from('business_profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();

        // 2. If not owner, check if member in business_team_members
        let businessId = businessProfile?.user_id;
        let isOwner = !!businessProfile;

        if (!businessProfile) {
            const { data: teamMember } = await supabaseAdmin
                .from('business_team_members')
                .select('business_id, role, status')
                .eq('user_id', authUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (teamMember?.business_id) {
                businessId = teamMember.business_id;
                const { data: parentBusiness } = await supabaseAdmin
                    .from('business_profiles')
                    .select('*')
                    .eq('user_id', teamMember.business_id)
                    .maybeSingle();
                businessProfile = parentBusiness;
            }
        }

        // 3. If no business profile exists at all for this user, generate a default one or virtual invite code
        let inviteCode = (businessProfile as any)?.org_invite_code;

        if (businessProfile && !inviteCode) {
            inviteCode = generateOrgCode(businessProfile.company_name);
            try {
                await supabaseAdmin
                    .from('business_profiles')
                    .update({ org_invite_code: inviteCode })
                    .eq('id', businessProfile.id);
            } catch {
                // If column doesn't exist yet, we continue with the computed code
            }
        } else if (!businessProfile) {
            const userCompany = (profile as any)?.company_name || profile?.full_name || 'EMPRESA';
            inviteCode = generateOrgCode(userCompany);
        }

        // 4. Ensure default channels exist if businessId is present
        if (businessId) {
            const defaultChannels = [
                { title: '#general', type: 'fleet', entity_type: 'fleet' },
                { title: '#novedades-flota', type: 'fleet', entity_type: 'fleet' },
                { title: '#alertas', type: 'system', entity_type: 'support' },
            ];

            for (const ch of defaultChannels) {
                const { data: existing } = await supabaseAdmin
                    .from('conversations')
                    .select('id')
                    .eq('business_id', businessId)
                    .eq('title', ch.title)
                    .maybeSingle();

                if (!existing) {
                    const { data: created } = await supabaseAdmin
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

                    if (created) {
                        await supabaseAdmin
                            .from('conversation_participants')
                            .insert({
                                conversation_id: created.id,
                                user_id: authUser.id,
                                role: isOwner ? 'owner' : 'member',
                            })
                            .maybeSingle();
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                businessId: businessId || null,
                companyName: businessProfile?.company_name || (profile as any)?.company_name || profile?.full_name || 'KargaX Logística',
                inviteCode: inviteCode || 'KX-KARGAX-2026',
                isOwner,
                role: isOwner ? 'owner' : 'member',
            },
        });
    } catch (err: any) {
        console.error('[Organization API] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Error al obtener datos de la organización' },
            { status: 500 }
        );
    }
}
