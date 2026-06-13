import { NextResponse } from 'next/server';
import { getGeoCatalogClient, mapDepartment } from '@/lib/geo/server';

export async function GET() {
  try {
    const supabase = getGeoCatalogClient();
    const { data, error } = await supabase
      .from('geo_departments')
      .select('id,country_code,divipola_code,name,normalized_name,is_capital_district')
      .eq('country_code', 'CO')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data || []).map(mapDepartment) });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'No se pudieron cargar departamentos',
    }, { status: 500 });
  }
}
