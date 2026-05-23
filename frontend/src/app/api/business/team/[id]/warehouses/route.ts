import { NextRequest, NextResponse } from 'next/server';
import { requireAal2Route } from '@/lib/server/route-auth';
import {
    getBusinessTeamInfrastructureStatus,
    resolveBusinessAccessContext,
    setActiveWarehousePreference,
} from '@/lib/server/warehouses';
import { toWarehouseMembershipRole } from '@/lib/business-roles';

interface RouteContext {
    params: Promise<{ id: string }>;
}

function getWarehouseRoleWriteError(error: { message?: string | null } | null | undefined) {
    const message = error?.message || 'Could not assign warehouses';
    const normalized = message.toLowerCase();

    if (normalized.includes('role_check') || normalized.includes('warehouse_members_role_check')) {
        return 'Aplica la migracion 046_business_role_presets.sql para asignar bodegas con roles empresariales avanzados.';
    }

    return message;
}

export async function POST(request: NextRequest, context: RouteContext) {
    const auth = await requireAal2Route(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (profile?.user_type !== 'admin' && (!businessAccess.businessId || !businessAccess.isOwner)) {
        return NextResponse.json({ error: 'Only owners or admins can assign warehouses' }, { status: 403 });
    }

    const teamInfrastructure = await getBusinessTeamInfrastructureStatus(supabaseAdmin);

    if (!teamInfrastructure.ready) {
        return NextResponse.json({
            error: teamInfrastructure.message || 'Business team infrastructure is not ready',
        }, { status: 503 });
    }

    const body = (await request.json()) as { warehouseIds?: string[] };
    const warehouseIds = Array.isArray(body.warehouseIds) ? Array.from(new Set(body.warehouseIds)) : [];

    let memberQuery = supabaseAdmin
        .from('business_team_members')
        .select('*')
        .eq('id', id);

    if (profile?.user_type !== 'admin') {
        memberQuery = memberQuery.eq('business_id', businessAccess.businessId || '');
    }

    const { data: member } = await memberQuery.single();

    if (!member?.user_id) {
        return NextResponse.json({ error: 'Team member must accept invitation before assigning warehouses' }, { status: 400 });
    }

    const businessId = member.business_id;

    const { data: companyWarehouses } = await supabaseAdmin
        .from('warehouses')
        .select('id')
        .eq('business_id', businessId)
        .in('id', warehouseIds.length ? warehouseIds : ['00000000-0000-0000-0000-000000000000']);

    const validWarehouseIds = new Set((companyWarehouses || []).map((warehouse) => warehouse.id));

    if (warehouseIds.some((warehouseId) => !validWarehouseIds.has(warehouseId))) {
        return NextResponse.json({ error: 'One or more warehouses do not belong to this company' }, { status: 400 });
    }

    const { data: currentMemberships } = await supabaseAdmin
        .from('warehouse_members')
        .select('id, warehouse_id')
        .eq('user_id', member.user_id);

    const currentByWarehouse = new Map((currentMemberships || []).map((item) => [item.warehouse_id, item]));

    const upserts = warehouseIds
        .filter((warehouseId) => !currentByWarehouse.has(warehouseId))
        .map((warehouseId) => ({
            warehouse_id: warehouseId,
            user_id: member.user_id,
            role: toWarehouseMembershipRole(member.role),
            active: true,
        }));

    const deactivations = (currentMemberships || [])
        .filter((item) => !warehouseIds.includes(item.warehouse_id))
        .map((item) => item.id);

    if (upserts.length) {
        const { error: upsertError } = await supabaseAdmin.from('warehouse_members').insert(upserts);
        if (upsertError) {
            return NextResponse.json({ error: getWarehouseRoleWriteError(upsertError) }, { status: 500 });
        }
    }

    if (deactivations.length) {
        const { error: deactivateError } = await supabaseAdmin
            .from('warehouse_members')
            .update({ active: false })
            .in('id', deactivations);

        if (deactivateError) {
            return NextResponse.json({ error: deactivateError.message || 'Could not deactivate warehouse assignments' }, { status: 500 });
        }
    }

    if (warehouseIds.length) {
        const { error: reactivateError } = await supabaseAdmin
            .from('warehouse_members')
            .update({ active: true, role: toWarehouseMembershipRole(member.role) })
            .eq('user_id', member.user_id)
            .in('warehouse_id', warehouseIds);

        if (reactivateError) {
            return NextResponse.json({ error: getWarehouseRoleWriteError(reactivateError) }, { status: 500 });
        }
    }

    await setActiveWarehousePreference(supabaseAdmin, member.user_id, warehouseIds[0] || null);

    return NextResponse.json({ success: true });
}
