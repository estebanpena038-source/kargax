import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { enforcePlanFeature, resolveBusinessAccessContext } from '@/lib/server/warehouses';

const BUCKET_NAME = 'warehouse-sku-images';
const MAX_IMAGES_PER_SKU = 5;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeFilename(filename: string) {
    return filename
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser, profile } = auth.context;
    const businessAccess = await resolveBusinessAccessContext(supabaseAdmin, authUser.id, profile);

    if (!businessAccess.businessId && profile?.user_type !== 'admin') {
        return NextResponse.json({ error: 'Business access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const skuId = String(formData.get('skuId') || '').trim();
    const isCover = String(formData.get('isCover') || '').toLowerCase() === 'true';
    const file = formData.get('file');

    if (!skuId || !(file instanceof File)) {
        return NextResponse.json({ error: 'skuId and file are required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'Only JPG, PNG and WEBP images are supported' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'Max image size is 8MB' }, { status: 400 });
    }

    const { data: sku } = await supabaseAdmin
        .from('warehouse_skus')
        .select('id, business_id')
        .eq('id', skuId)
        .maybeSingle();

    if (!sku) {
        return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    if (
        profile?.user_type !== 'admin' &&
        sku.business_id !== businessAccess.businessId
    ) {
        return NextResponse.json({ error: 'SKU access denied' }, { status: 403 });
    }

    await enforcePlanFeature(supabaseAdmin, sku.business_id, 'includes_inventory');

    const { data: existingImages } = await supabaseAdmin
        .from('warehouse_sku_images')
        .select('id, is_cover')
        .eq('sku_id', skuId)
        .order('sort_order', { ascending: true });

    if ((existingImages || []).length >= MAX_IMAGES_PER_SKU) {
        return NextResponse.json({ error: 'This SKU already reached the 5 image limit' }, { status: 409 });
    }

    if (isCover) {
        await supabaseAdmin
            .from('warehouse_sku_images')
            .update({ is_cover: false })
            .eq('sku_id', skuId);
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const storagePath = `${skuId}/${Date.now()}-${sanitizeFilename(file.name || `image.${fileExtension}`)}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    const { data: imageRecord, error: imageError } = await supabaseAdmin
        .from('warehouse_sku_images')
        .insert({
            sku_id: skuId,
            storage_path: storagePath,
            public_url: publicUrlData.publicUrl,
            is_cover: isCover || (existingImages || []).length === 0,
            sort_order: (existingImages || []).length,
            created_by: authUser.id,
        })
        .select('*')
        .single();

    if (imageError || !imageRecord) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
        return NextResponse.json({ error: imageError?.message || 'Could not save image' }, { status: 500 });
    }

    return NextResponse.json({ data: imageRecord }, { status: 201 });
}
