import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRoute } from '@/lib/server/route-auth';
import { getGeoCatalogClient, mapLocalZone, normalizeForGeoSearch } from '@/lib/geo/server';

const VALID_ZONE_TYPES = new Set([
  'barrio', 'localidad', 'comuna', 'vereda', 'corregimiento', 'centro_poblado', 'sector', 'otro',
]);

export async function GET(request: NextRequest) {
  try {
    const supabase = getGeoCatalogClient();
    const municipalityId = request.nextUrl.searchParams.get('municipalityId');
    const q = normalizeForGeoSearch(request.nextUrl.searchParams.get('q'));

    if (!municipalityId) {
      return NextResponse.json({ success: true, data: [] });
    }

    let query = supabase
      .from('geo_local_zones')
      .select('id,department_id,municipality_id,divipola_code,name,normalized_name,zone_type,source,confidence,is_user_submitted,needs_review')
      .eq('municipality_id', municipalityId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(250);

    if (q) {
      query = query.ilike('normalized_name', `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data || []).map(mapLocalZone) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'No se pudieron cargar zonas internas',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedRoute(request);

  if ('response' in auth) {
    return auth.response;
  }

  const { supabaseAdmin, authUser } = auth.context;
  const body = await request.json().catch(() => null) as {
    municipalityId?: string;
    name?: string;
    zoneType?: string;
  } | null;

  const municipalityId = body?.municipalityId || '';
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  const zoneType = VALID_ZONE_TYPES.has(body?.zoneType || '') ? body?.zoneType : 'otro';

  if (!municipalityId || name.length < 2) {
    return NextResponse.json({ success: false, data: null, error: 'Municipio y zona interna son requeridos' }, { status: 400 });
  }

  if (name.length > 120) {
    return NextResponse.json({ success: false, data: null, error: 'La zona interna es demasiado larga' }, { status: 400 });
  }

  const { data: municipality, error: municipalityError } = await supabaseAdmin
    .from('geo_municipalities')
    .select('id, department_id')
    .eq('id', municipalityId)
    .eq('is_active', true)
    .maybeSingle();

  if (municipalityError || !municipality) {
    return NextResponse.json({ success: false, data: null, error: municipalityError?.message || 'Municipio no encontrado' }, { status: 404 });
  }

  const normalizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const insertPayload = {
    department_id: municipality.department_id,
    municipality_id: municipality.id,
    name,
    normalized_name: normalizedName,
    zone_type: zoneType,
    source: 'user_input',
    source_url: null,
    confidence: 0.25,
    is_user_submitted: true,
    needs_review: true,
    created_by: authUser.id,
    is_active: true,
  };

  const { data, error } = await supabaseAdmin
    .from('geo_local_zones')
    .insert(insertPayload)
    .select('id,department_id,municipality_id,divipola_code,name,normalized_name,zone_type,source,confidence,is_user_submitted,needs_review')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('geo_local_zones')
        .select('id,department_id,municipality_id,divipola_code,name,normalized_name,zone_type,source,confidence,is_user_submitted,needs_review')
        .eq('municipality_id', municipality.id)
        .eq('normalized_name', normalizedName)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, data: mapLocalZone(existing) }, { status: 200 });
      }
    }

    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: mapLocalZone(data) }, { status: 201 });
}
