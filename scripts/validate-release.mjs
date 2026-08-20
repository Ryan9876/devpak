import { existsSync, readFileSync } from 'node:fs';

const required = [
  'PROJECT-CONSTITUTION.md','ARCHITECTURE.md','DESIGN-SYSTEM.md','CURRENT-STATE.md',
  'src/lib/room-model/types.ts','src/lib/room-model/geometry.ts','src/lib/room-model/repository.ts',
  'src/components/Studio.tsx','src/app/object-tools.css','src/app/studio/page.tsx','src/app/projects/page.tsx','src/app/projects/actions.ts',
  'src/app/projects/[projectId]/studio/page.tsx','src/app/api/health/backend/route.ts',
  'supabase/migrations/202608200001_phase2_room_model.sql','supabase/migrations/202608200002_phase2_indexes.sql'
];
const missing = required.filter((p) => !existsSync(p));
if (missing.length) throw new Error(`Missing canonical files: ${missing.join(', ')}`);
const pkg = JSON.parse(readFileSync('package.json','utf8'));
for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
  if (version === 'latest' || String(version).includes('*')) throw new Error(`Unpinned runtime dependency: ${name}@${version}`);
}
const legacyStudio = readFileSync('src/app/studio/page.tsx','utf8');
if (!legacyStudio.includes('/projects/${projects[0].id}/studio') || !legacyStudio.includes('createProjectWithStarterRoom')) {
  throw new Error('Legacy /studio route is not project-scoped.');
}
const projectStudio = readFileSync('src/app/projects/[projectId]/studio/page.tsx','utf8');
if (!projectStudio.includes('loadProjectRoom') || !projectStudio.includes('ownerId')) {
  throw new Error('Project Studio must enforce project + owner scoped loading.');
}
const studio = readFileSync('src/components/Studio.tsx','utf8');
for (const marker of ['addObject','resizeSelected','rotateSelected','deleteSelected','findOpenPlacement']) {
  if (!studio.includes(marker)) throw new Error(`Missing visual object tool: ${marker}`);
}
if (!studio.includes('Fixed elements are protected')) throw new Error('Fixed-element editing protection is missing.');
if (existsSync('.env.production')) {
  console.warn('NESTMETRIC_RELEASE_WARNING .env.production exists locally and is intentionally gitignored.');
}
console.log('NESTMETRIC_RELEASE_STRUCTURE_PASS', { required: required.length, runtimeDependencies: Object.keys(pkg.dependencies ?? {}).length, projectScopedStudio: true, objectTools: true });
