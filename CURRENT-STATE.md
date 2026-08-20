# NestMetric Current State

## v0.2.3 project-scoped persistence preview
Status: **validated preview; canonical Git branch; not yet production-promoted.**

### v0.2.3 changes
- Durable Projects dashboard added at `/projects`.
- Authenticated users can create named projects; each project receives one starter Room Model.
- Project-specific Studio route added at `/projects/[projectId]/studio`.
- Project Studio loading is scoped by both `project_id` and authenticated `owner_id`; RLS remains authoritative.
- Legacy `/studio` now resolves to the user’s latest project or creates the first project and redirects to its explicit URL.
- Project creation cleanup is fail-safe: a partially created project is deleted if room/object/opening initialization fails, with cascading cleanup.
- Primary navigation and landing CTA now expose Projects as the durable entry point.
- Release validation now requires project-scoped routes/actions and rejects a non-project-scoped compatibility Studio.

### v0.2.3 validation
- Branch: `parallax/nestmetric-v0.2.3-persistence`
- Preview deployment: `dpl_93VA4zGjxpmin6NBL2ToRjremXH9`
- Preview URL: `https://nestmetric-5duo4o31p-lew7.vercel.app`
- State: `READY`
- Validation/build duration after source retrieval: about 23 seconds.
- `validate:full` passed: release structure, strict TypeScript, 3/3 Room Model domain tests, schema gate, Next.js production build.
- Built routes include `/projects`, `/projects/[projectId]/studio`, `/studio`, `/login`, backend health, auth callback/signout and AI planning.
- Vercel runtime-error scan after deployment: no error clusters.
- Production alias has not been changed.

## v0.2.2 Phase 2 durable-backend baseline
Status: **canonical Git source established on `main`; dedicated Supabase backend provisioned/migrated; backend-connected Vercel preview build validated and READY; not yet production-promoted.**

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
- Foreign-key index findings were repaired; remaining unused-index notices are expected on the empty new database.

### v0.2.2 application changes
- Supabase SSR runtime wired to the dedicated project using the publishable key only; RLS remains authoritative.
- Email magic-link sign-in is the launch-capable authentication path.
- Google OAuth remains prepared but disabled until external Google provider credentials are configured.
- Auth callback supports PKCE code exchange and email token-hash verification.
- Studio exposes sign-out for authenticated sessions.
- Backend health route checks real Supabase connectivity and anonymous RLS non-disclosure.
- Canonical Room Model, Organize / Arrange / Build Studio, geometry/build gating, private Storage capture, planning persistence and measurement verification remain intact.

### Production state
The existing NestMetric production alias remains on the previously verified release. Production cutover remains gated on a real authenticated persistence acceptance check against Supabase.

### Known external constraints
- Google OAuth credentials are not configured; Google sign-in is intentionally disabled. Email magic-link authentication is the launch fallback.

## Development workflow normalization
- GitHub `main` is the canonical source of truth; normal development no longer reconstructs source from Vercel artifacts.
- Changes use `parallax/...` branches and PRs.
- Risk-scoped validation commands are available: `validate:ui`, `validate:domain`, `validate:full`, and `classify:change`.
- Normal release flow is: source change → scoped validation → one preview → live acceptance → merge/promotion.
- Vercel chunk/bootstrap source transport is retired for normal development. The current connector lacks direct `gitSource`; the preview bridge downloads one pinned public Git commit tarball rather than rebuilding source from deployment artifacts.
