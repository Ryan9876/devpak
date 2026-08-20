# NestMetric Current State

## v0.2.2 Phase 2 durable-backend release candidate
Status: **canonical Git source established on `main`; dedicated Supabase backend provisioned/migrated; backend-connected Vercel preview build validated and READY; not yet production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical `main` baseline: `dc889c244b2bc7d1328ab2e04374ff1b37dc2670` (squash merge of PR #1).
- Validated preview source commit: `a91326e9d65a8d5b7203c34a39612e40186f51eb`; subsequent source-control changes before merge were record-only and did not alter application behavior.
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

### Backend-connected preview
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`)
- Preview deployment: `dpl_3p41A3kZdMKng9Pe6sBfJV4Veexu`
- Preview URL: `https://nestmetric-eza9u7dyr-lew7.vercel.app`
- State: `READY`
- Canonical Git commit archive retrieved successfully from GitHub and built directly; no Vercel source-chunk transport was used.
- `validate:full` passed: release structure, strict TypeScript, 3/3 domain tests, Room Model schema gate, and Next.js 16.3.1 production build.
- Build completed in about 26 seconds after source retrieval.
- Deployment Protection prevents the available verifier from completing an external cookie-authenticated route smoke without forwarding a temporary share token; that verifier limitation is not treated as deployment verification.

### Production state
The existing NestMetric production alias remains on the previously verified release. v0.2.2 will not be production-promoted until a real authenticated persistence acceptance check proves account/session, project/room persistence, object movement, measurement persistence, and private asset storage against Supabase.

### Known external constraints
- Google OAuth credentials are not configured; Google sign-in is intentionally disabled. Email magic-link authentication is the launch fallback.

## Development workflow normalization — 2026-08-19
- GitHub `main` is now the canonical source of truth; normal development no longer reconstructs source from Vercel artifacts.
- Changes use `parallax/...` branches and PRs.
- Risk-scoped validation commands are available: `validate:ui`, `validate:domain`, `validate:full`, and `classify:change`.
- Normal release flow is: source change → scoped validation → one preview → live acceptance → merge/promotion.
- Vercel chunk/bootstrap source transport is retired for normal development. The current connector lacks direct `gitSource`; the temporary preview bridge downloads one pinned public Git commit tarball rather than rebuilding source from deployment artifacts.
