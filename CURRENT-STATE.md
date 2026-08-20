# NestMetric Current State

## v0.2.2 Phase 2 durable-backend release candidate
Status: **generated and locally validated; dedicated Supabase backend provisioned and migrated; backend-connected Vercel preview pending final deployment verification; not yet production-promoted.**

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
- Performance advisor: foreign-key index findings repaired; remaining unused-index notices are expected on an empty new database.

### v0.2.2 application changes
- Supabase SSR runtime wired to the dedicated project using the publishable key only; RLS remains authoritative.
- Email magic-link sign-in is the launch-capable authentication path.
- Google OAuth remains prepared but disabled until external Google provider credentials are configured.
- Auth callback supports PKCE code exchange and email token-hash verification.
- Studio exposes sign-out for authenticated sessions.
- Backend health route verifies anonymous connectivity and RLS non-disclosure.
- Canonical Room Model, Organize / Arrange / Build Studio, geometry/build gating, Storage capture, planning persistence and measurement verification remain unchanged from v0.2.1.

### Production state
The existing NestMetric production alias remains on the previously verified release until v0.2.2 passes backend-connected preview build/live checks and a real authenticated persistence acceptance check. No production cutover is recorded yet.

### Known external constraints
- Google OAuth credentials are not configured; Google sign-in is intentionally disabled.

## Development workflow normalization — 2026-08-19
- Canonical workspace established from the v0.2.2 release candidate.
- GitHub branch `parallax/nestmetric-v0.2.2` created successfully from `main`; branch-based source control replaces Vercel artifact transport.
- Runtime dependencies are pinned; `.env.production` is excluded from source control.
- Risk-scoped validation commands added (`validate:ui`, `validate:domain`, `validate:full`, `classify:change`).
- The previous chunk/bootstrap source-transport mechanism is retired for normal development.
