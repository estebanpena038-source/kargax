import { NextRequest, NextResponse } from 'next/server';
import { getGeoCatalogClient, mapMunicipality, normalizeForGeoSearch } from '@/lib/geo/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getGeoCatalogClient();
    const departmentId = request.nextUrl.searchParams.get('departmentId');
    const departmentCode = request.nextUrl.searchParams.get('departmentCode');
    const q = normalizeForGeoSearch(request.nextUrl.searchParams.get('q'));
    let resolvedDepartmentId = departmentId || '';

    if (!resolvedDepartmentId && departmentCode) {
      const { data: department, error: departmentError } = await supabase
        .from('geo_departments')
        .select('id')
        .eq('country_code', 'CO')
        .eq('divipola_code', departmentCode)
        .eq('is_active', true)
        .maybeSingle();

      if (departmentError) {
        return NextResponse.json({ success: false, data: [], error: departmentError.message }, { status: 500 });
      }

      resolvedDepartmentId = department?.id || '';
    }

    if (!resolvedDepartmentId) {
      return NextResponse.json({ success: true, data: [] });
    }

    let query = supabase
      .from('geo_municipalities')
      .select('id,department_id,country_code,divipola_code,name,normalized_name,type,is_capital')
      .eq('department_id', resolvedDepartmentId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (q) {
      query = query.ilike('normalized_name', `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data || []).map(mapMunicipality) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'No se pudieron cargar municipios',
    }, { status: 500 });
  }
}
