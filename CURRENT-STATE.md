# NestMetric Current State

## v0.2.7 durable Build Planner
Status: **validated preview; canonical Git branch; not yet production-promoted.**

### v0.2.7 changes
- Project Studio now includes a durable Build Planner beneath the visual Room Model workspace.
- Build requests explicitly provide build type, desired width/height/depth and primary material rather than deriving construction dimensions from image estimates.
- Supported build kinds are shelving, storage, desk and cabinet.
- Build generation requires verified/corrected `wall width` and `wall depth` evidence; estimated required evidence is rejected.
- The deterministic generator checks candidate placement against room bounds, openings and fixed objects using the shared Room Model geometry engine.
- Generated artifacts include overall dimensions, placement, front/side clearances, component dimensions, materials, 10% planning waste, evidence snapshot, assumptions, nonbinding material-cost range and nonbinding effort range.
- Conflicted artifacts may be saved for iteration but are explicitly labeled `conflicted` rather than ready.
- Build artifacts persist to owner-scoped `build_plans` with geometry, materials, verification snapshot, assumptions and estimates.
- Studio shows recent saved build-plan history.
- Build output explicitly states that it is planning output, not code-compliance, structural-engineering or professional construction approval.
- Release validation now enforces the Build generator safety contract, durable API persistence and Build Planner output sections.

### v0.2.7 validation
- Branch: `parallax/nestmetric-v0.2.7-build-plans`
- Preview deployment: `dpl_EaSUPv65tJXpzzJf8kJuXv7tP6hN`
- Preview URL: `https://nestmetric-4wxrnh24m-lew7.vercel.app`
- State: `READY`
- Canonical source commit tested: `593760eb14543ecb0c030d617bb9cc64c308b021`
- Full validation/build completed in about 18 seconds after source retrieval.
- Release structure PASS with `buildPlans: true`.
- Strict TypeScript PASS.
- Room Model/domain tests: 6/6 PASS, including verified Build generation and rejection of estimated required evidence.
- Room Model schema gate PASS.
- Next.js 16.3.1 production build PASS, including `/api/builds`.
- Preview runtime error/fatal log scan: no findings.
- Production alias has not been changed.

## v0.2.6 room evidence
Status: **validated and merged to canonical `main`; production alias unchanged.**

### v0.2.6 changes
- Private room captures are now visible inside the Studio after upload using short-lived signed Supabase Storage URLs.
- Capture loading remains scoped by both authenticated `owner_id` and `room_id`.
- Uploads reject non-image files and room photos larger than 15 MB before Storage writes begin.
- Capture metadata records the guided web capture method, platform, user agent and capture timestamp.
- Deletion is fail-safe: metadata is soft-marked, private Storage bytes are removed, the mark is rolled back if Storage deletion fails, and metadata is deleted only after byte deletion succeeds.
- Measurement entry now distinguishes verified manual evidence from photo estimates.
- Photo estimates are explicitly stored as `estimated` with lower confidence and wider tolerance.
- Estimated measurements expose a user correction flow that records from/to values, timestamp and reason, then marks the evidence `corrected` with calibrated reference metadata.
- Build gating continues to reject estimates and accepts only verified/corrected evidence.
- Dedicated evidence styles preserve the current NestMetric visual language and collapse the capture gallery to one column on mobile.
- Release validation now requires private signed capture URLs, file-size guarding, deletion handling, photo-estimate state and correction history.

### v0.2.6 validation
- Branch: `parallax/nestmetric-v0.2.6-evidence`
- Preview deployment: `dpl_Dtr8g5a9Ewk9wNNVeUSssVEbG8AB`
- Preview URL: `https://nestmetric-6s6mszw2x-lew7.vercel.app`
- State: `READY`
- Canonical source commit tested: `4d396aba356e65c2e8fb649147ac168f86507d19`
- Full validation/build completed in about 15 seconds after source retrieval.
- Release structure PASS with `roomEvidence: true`.
- Strict TypeScript PASS.
- Room Model domain tests: 4/4 PASS.
- Room Model schema gate PASS.
- Next.js 16.3.1 production build PASS.
- Preview runtime error/fatal log scan: no findings.
- PR #5 squash merge: `9f3da9f766d34679c5a898a13072833960f04540`.
- Production alias has not been changed.

## v0.2.5 project-scoped proposal history
Status: **validated and merged to canonical `main`; production alias unchanged.**

### v0.2.5 changes
- Planning requests are explicitly scoped to the active `projectId`; `/api/ai/plan` no longer selects the user's first room implicitly.
- Proposal generation loads the Room Model through the existing owner + project-scoped repository boundary.
- Generated proposals are persisted to `planning_proposals` before being returned to the Studio.
- The persisted database UUID replaces transient/deterministic proposal IDs for authenticated project history.
- Proposal decisions are recorded through `/api/proposals/[proposalId]/decision` with owner scoping and `decided_at` timestamps.
- Studio supports explicit Apply and Reject decisions and records both in project history.
- Applying a proposal now stops if any object persistence operation fails rather than reporting a partially saved layout as complete.
- Release validation now requires project-scoped planning, proposal persistence and durable decision handling.

### v0.2.5 validation
- Branch: `parallax/nestmetric-v0.2.5-proposal-history`
- Preview deployment: `dpl_EKq1h7mb61VT4MMsCMdqShUPxk3D`
- Preview URL: `https://nestmetric-7s5vgdbtt-lew7.vercel.app`
- State: `READY`
- Canonical source commit tested: `d888b58f2dae90ceac0d23a3c7091f9759aacf38`
- Full validation/build completed in about 16 seconds after source retrieval.
- Release structure PASS with proposal-history contract enabled.
- Strict TypeScript PASS.
- Room Model domain tests: 4/4 PASS.
- Room Model schema gate PASS.
- Next.js 16.3.1 production build PASS, including `/api/proposals/[proposalId]/decision`.
- Preview runtime error/fatal log scan: no findings.
- PR #4 squash merge: `4d677b3ce52588a4f6a9df3a8febcaffdbf04051`.
- Production alias has not been changed.

## v0.2.4 visual object tools
Status: **validated preview; canonical Git branch; not yet production-promoted.**

### v0.2.4 changes
- Studio can add new movable room objects with label and width/depth dimensions.
- New objects are placed only at a geometry-valid open location and persist through Supabase/RLS.
- Selected movable objects can be resized, rotated in 15° increments and deleted.
- Fixed elements are protected from move/resize/rotate/delete actions.
- Drag gestures persist the exact final valid pointer position instead of relying on stale React render state.
- Rotation-aware geometry now uses the rotated axis-aligned bounding box for room boundaries, fixed-object collision checks and opening-clearance checks.
- Studio exposes a Projects return link and object-editing controls remain responsive on mobile.
- Release validation requires add/resize/rotate/delete/open-placement capabilities and fixed-element protection.

### v0.2.4 validation
- Branch: `parallax/nestmetric-v0.2.4-object-tools`
- Final preview deployment: `dpl_2oDBDbnhG8XLuWvk5iUrYiJuBib5`
- Preview URL: `https://nestmetric-b3z58epnm-lew7.vercel.app`
- State: `READY`
- Canonical source commit tested: `523138d3b0679ef9152ab8005c7226740e609fcf`
- `validate:full` passed: release structure, strict TypeScript, 4/4 domain tests, Room Model schema gate and Next.js production build.
- Added regression coverage proving a rotated object that crosses the room boundary is rejected.
- Vercel runtime-error scan after deployment: no error clusters.
- Production alias has not been changed.

## Durable persistence acceptance
Status: **database/RLS persistence acceptance passed; end-user browser magic-link and real browser Storage-byte acceptance remain separate release checks.**

A disposable authenticated JWT context exercised the actual Supabase RLS policies and was fully cleaned up afterward. Results:
- owner project visibility: `1`
- persisted object position/rotation: `450000,650000,15.000`
- verified measurement persisted as `verified`
- owner room-asset metadata visibility: `1`
- owner private Storage policy visibility: `1`
- second authenticated user project visibility: `0`
- second authenticated user Storage visibility: `0`
- cleanup verification: `0` test users, `0` test projects, `0` test Storage rows

This proves the durable Postgres ownership boundary, object updates, verified measurement persistence, asset metadata persistence and Storage owner isolation. It does not claim an end-user email magic-link browser session or actual browser upload/download bytes were verified.

## v0.2.3 project-scoped persistence
Status: **validated and merged to canonical `main`; production alias unchanged.**

### v0.2.3 changes
- Durable Projects dashboard added at `/projects`.
- Authenticated users can create named projects; each project receives one starter Room Model.
- Project-specific Studio route added at `/projects/[projectId]/studio`.
- Project Studio loading is scoped by both `project_id` and authenticated `owner_id`; RLS remains authoritative.
- Legacy `/studio` resolves to the user’s latest project or creates the first project and redirects to its explicit URL.
- Project creation cleanup is fail-safe: a partially created project is deleted if room/object/opening initialization fails, with cascading cleanup.
- Primary navigation and landing CTA expose Projects as the durable entry point.
- Release validation requires project-scoped routes/actions and rejects a non-project-scoped compatibility Studio.

### v0.2.3 validation
- Preview deployment: `dpl_93VA4zGjxpmin6NBL2ToRjremXH9`
- Preview URL: `https://nestmetric-5duo4o31p-lew7.vercel.app`
- State: `READY`
- Validation/build duration after source retrieval: about 23 seconds.
- `validate:full` passed: release structure, strict TypeScript, 3/3 Room Model domain tests, schema gate and Next.js production build.
- Vercel runtime-error scan: no error clusters.
- PR #2 squash merge: `90e7d599e4191f2dc1a2759adb347f468e7fef77`.

## v0.2.2 Phase 2 durable-backend baseline
Status: **canonical Git source established on `main`; dedicated Supabase backend provisioned/migrated; backend-connected Vercel preview validated; production not yet cut over.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical source is maintained through `parallax/...` branches and pull requests.
- Temporary Vercel/bootstrap source artifacts are not part of the canonical tree.
- Runtime dependencies are pinned and `.env.production` is excluded from source control.

### Durable backend
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`)
- Organization: `Ryan9876's Org` (`qjxihuxzncnpbjnwuaie`)
- Region: `us-east-1`
- Creation cost confirmed: `$0/month`
- Project state after creation: `ACTIVE_HEALTHY`
- Migrations applied: `phase2_room_model` and the covering-index migration; both migration files are canonical source artifacts.
- Eight owner-scoped public tables have RLS enabled.
- Storage bucket `room-assets` is private and storage-object operations are owner scoped.
- Supabase security advisor: no findings after migration.
- Foreign-key index findings were repaired; remaining unused-index notices are expected on a new database.

### Authentication
- Supabase SSR runtime uses the dedicated project’s publishable key only; RLS remains authoritative.
- Email magic-link sign-in is the launch-capable authentication path.
- Google OAuth remains prepared but disabled until external Google provider credentials are configured.
- Auth callback supports PKCE code exchange and email token-hash verification.
- Studio exposes sign-out for authenticated sessions.

### Production state
The existing NestMetric production alias remains on the previously verified pre-Phase-2 release. Production cutover remains gated on completing the remaining browser-level authentication/Storage acceptance and a deliberate promotion of the validated canonical release.

## Development workflow normalization
- GitHub `main` is the canonical source of truth; normal development no longer reconstructs source from Vercel artifacts.
- Changes use `parallax/...` branches and PRs.
- Risk-scoped validation commands are available: `validate:ui`, `validate:domain`, `validate:full`, and `classify:change`.
- Normal release flow is: source change → scoped validation → one preview → live acceptance → merge/promotion.
- Vercel chunk/bootstrap source transport is retired for normal development. The current connector lacks direct `gitSource`; the preview bridge downloads one pinned public Git commit tarball rather than rebuilding source from deployment artifacts.
