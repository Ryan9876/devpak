import { existsSync, readFileSync } from 'node:fs';

const required = [
  'PROJECT-CONSTITUTION.md','ARCHITECTURE.md','DESIGN-SYSTEM.md','CURRENT-STATE.md',
  'src/lib/room-model/types.ts','src/lib/room-model/geometry.ts','src/lib/room-model/repository.ts','src/lib/builds/generate.ts',
  'src/components/Studio.tsx','src/components/CapturePanel.tsx','src/components/MeasurementPanel.tsx','src/components/BuildPlanner.tsx',
  'src/app/object-tools.css','src/app/evidence.css','src/app/build-plans.css','src/app/studio/page.tsx','src/app/projects/page.tsx','src/app/projects/actions.ts',
  'src/app/projects/[projectId]/studio/page.tsx','src/app/api/health/backend/route.ts','src/app/api/ai/plan/route.ts','src/app/api/builds/route.ts',
  'src/app/api/proposals/[proposalId]/decision/route.ts',
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
if (!projectStudio.includes('BuildPlanner')) throw new Error('Project Studio must expose the durable Build Planner.');
const studio = readFileSync('src/components/Studio.tsx','utf8');
for (const marker of ['addObject','resizeSelected','rotateSelected','deleteSelected','findOpenPlacement']) {
  if (!studio.includes(marker)) throw new Error(`Missing visual object tool: ${marker}`);
}
if (!studio.includes('Fixed elements are protected')) throw new Error('Fixed-element editing protection is missing.');
if (!studio.includes('projectId: room.projectId') || !studio.includes('/decision')) {
  throw new Error('Studio proposal lifecycle is not explicitly project-scoped and durable.');
}
const planRoute = readFileSync('src/app/api/ai/plan/route.ts','utf8');
for (const marker of ['loadProjectRoom','projectId','planning_proposals']) {
  if (!planRoute.includes(marker)) throw new Error(`Planning route missing durable project scope: ${marker}`);
}
const decisionRoute = readFileSync('src/app/api/proposals/[proposalId]/decision/route.ts','utf8');
if (!decisionRoute.includes('owner_id') || !decisionRoute.includes('decided_at')) {
  throw new Error('Proposal decisions must remain owner-scoped and timestamped.');
}
const capture = readFileSync('src/components/CapturePanel.tsx','utf8');
for (const marker of ['createSignedUrl','MAX_IMAGE_BYTES','removeAsset','deleted_at']) {
  if (!capture.includes(marker)) throw new Error(`Room capture workflow missing: ${marker}`);
}
const measurement = readFileSync('src/components/MeasurementPanel.tsx','utf8');
for (const marker of ['photo_estimate','corrected','correction_history','Correct & verify']) {
  if (!measurement.includes(marker)) throw new Error(`Measurement evidence workflow missing: ${marker}`);
}
const buildGenerator = readFileSync('src/lib/builds/generate.ts','utf8');
for (const marker of ['buildVerificationGate','BuildEvidenceError','componentsFor','materialPlan','nonbinding: true','validatePlacement']) {
  if (!buildGenerator.includes(marker)) throw new Error(`Build generator missing safety contract: ${marker}`);
}
const buildRoute = readFileSync('src/app/api/builds/route.ts','utf8');
for (const marker of ['loadProjectRoom','build_plans','verification_snapshot','owner_id']) {
  if (!buildRoute.includes(marker)) throw new Error(`Build API missing durable project contract: ${marker}`);
}
const buildPlanner = readFileSync('src/components/BuildPlanner.tsx','utf8');
for (const marker of ['Generate verified build plan','Measurement evidence','Materials','Assumptions & limitations','Saved build plans']) {
  if (!buildPlanner.includes(marker)) throw new Error(`Build Planner UI missing: ${marker}`);
}
if (existsSync('.env.production')) {
  console.warn('NESTMETRIC_RELEASE_WARNING .env.production exists locally and is intentionally gitignored.');
}
console.log('NESTMETRIC_RELEASE_STRUCTURE_PASS', { required: required.length, runtimeDependencies: Object.keys(pkg.dependencies ?? {}).length, projectScopedStudio: true, objectTools: true, proposalHistory: true, roomEvidence: true, buildPlans: true });
