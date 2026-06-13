#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createAdminClient } from './_supabase-loader.mjs';

async function fetchAll(supabase, table, columns) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function main() {
  const supabase = createAdminClient();
  const [departments, municipalities, localZones, versions] = await Promise.all([
    fetchAll(supabase, 'geo_departments', '*'),
    fetchAll(supabase, 'geo_municipalities', '*'),
    fetchAll(supabase, 'geo_local_zones', '*'),
    fetchAll(supabase, 'geo_seed_versions', '*'),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    counts: {
      departments: departments.length,
      municipalities: municipalities.length,
      localZones: localZones.length,
      versions: versions.length,
    },
    departments,
    municipalities,
    localZones,
    versions,
  };

  const outputPath = process.env.GEO_EXPORT_OUT || path.join(process.cwd(), 'geo-colombia-export.json');
  fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2));
  console.log(`[geo:export] Export escrito en ${outputPath}`);
}

main().catch((error) => {
  console.error('[geo:export] ERROR:', error.message);
  process.exit(1);
});
