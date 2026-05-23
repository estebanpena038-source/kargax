import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { enforcePlanFeature, resolveBusinessAccessContext } from '@/lib/server/warehouses';

const BUCKET_NAME = 'warehouse-sku-images';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { id } = await context.params;
    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    const { data: imageRecord } = await supabaseAdmin
        .from('warehouse_sku_images')
        .select('*, sku:warehouse_skus(id, business_id)')
        .eq('id', id)
        .maybeSingle();

    if (!imageRecord) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const skuBusinessId = imageRecord.sku?.business_id || null;

    if (!skuBusinessId) {
        return NextResponse.json({ error: 'Invalid image relation' }, { status: 400 });
    }

    if (
        profile?.user_type !== 'admin' &&
        skuBusinessId !== businessAccess.businessId
    ) {
        return NextResponse.json({ error: 'Image access denied' }, { status: 403 });
    }

    await enforcePlanFeature(supabaseAdmin, skuBusinessId, 'includes_inventory');

    await supabaseAdmin
        .from('warehouse_sku_images')
        .delete()
        .eq('id', id);

    await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove([imageRecord.storage_path]);

    const { data: remainingImages } = await supabaseAdmin
        .from('warehouse_sku_images')
        .select('id')
        .eq('sku_id', imageRecord.sku_id)
        .order('sort_order', { ascending: true });

    if (imageRecord.is_cover && remainingImages?.length) {
        await supabaseAdmin
            .from('warehouse_sku_images')
            .update({ is_cover: true })
            .eq('id', remainingImages[0].id);
    }

    return NextResponse.json({ success: true });
}
