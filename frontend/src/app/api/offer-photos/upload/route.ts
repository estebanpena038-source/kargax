import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';

const BUCKET_NAME = 'offer-photos';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizePathSegment(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9./-]+/g, '-')
        .replace(/\/+/g, '/')
        .replace(/-+/g, '-')
        .replace(/^\/+|\/+$/g, '')
        .slice(0, 140) || 'offers';
}

function sanitizeFilename(filename: string) {
    return filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90) || 'image.jpg';
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthenticatedRoute(request);

    if ('response' in auth) {
        return auth.response;
    }

    const { supabaseAdmin, authUser } = auth.context;
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = sanitizePathSegment(String(formData.get('folder') || 'offers'));

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'Solo imagenes JPG, PNG o WebP' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'La imagen no puede superar 5MB' }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFilename(file.name || `image.${extension}`)}`;
    const storagePath = `${authUser.id}/${folder}/${fileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return NextResponse.json({
        data: {
            publicUrl: publicUrlData.publicUrl,
            storagePath,
            bucket: BUCKET_NAME,
        },
    }, { status: 201 });
}
