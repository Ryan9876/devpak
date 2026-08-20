import { existsSync, readFileSync } from 'node:fs';

const required = [
  'PROJECT-CONSTITUTION.md','ARCHITECTURE.md','DESIGN-SYSTEM.md','CURRENT-STATE.md',
  'src/lib/room-model/types.ts','src/lib/room-model/geometry.ts','src/lib/room-model/repository.ts',
  'src/components/Studio.tsx','src/app/studio/page.tsx','src/app/api/health/backend/route.ts',
  'supabase/migrations/202608200001_phase2_room_model.sql'
];
const missing = required.filter((p) => !existsSync(p));
if (missing.length) throw new Error(`Missing canonical files: ${missing.join(', ')}`);
const pkg = JSON.parse(readFileSync('package.json','utf8'));
for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
  if (version === 'latest' || String(version).includes('*')) throw new Error(`Unpinned runtime dependency: ${name}@${version}`);
}
if (existsSync('.env.production')) {
  console.warn('NESTMETRIC_RELEASE_WARNING .env.production exists locally and is intentionally gitignored.');
}
console.log('NESTMETRIC_RELEASE_STRUCTURE_PASS', { required: required.length, runtimeDependencies: Object.keys(pkg.dependencies ?? {}).length });
