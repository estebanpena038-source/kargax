import { NextRequest, NextResponse } from 'next/server';
import { getGeoCatalogClient } from '@/lib/geo/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      departmentId?: string | null;
      municipalityId?: string | null;
      localZoneId?: string | null;
    } | null;

    const supabase = getGeoCatalogClient();
    const { data, error } = await supabase.rpc('geo_validate_location', {
      p_department_id: body?.departmentId || null,
      p_municipality_id: body?.municipalityId || null,
      p_local_zone_id: body?.localZoneId || null,
    });

    if (error) {
      return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'No se pudo validar la ubicación',
    }, { status: 500 });
  }
}
