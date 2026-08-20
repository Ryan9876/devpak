# NestMetric Current State

## v0.2.2 Phase 2 durable-backend release candidate
Status: **canonical Git source established on `main`; dedicated Supabase backend provisioned/migrated; Google OAuth live acceptance passed; starter Room Model persistence confirmed; first-load Studio reload defect fixed in source; full persistence acceptance still in progress; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical `main` head before this auth fix: `b0800d7ba379912f703ec322fab24ae08d4be436`.
- Active auth-fix branch: `parallax/server-google-oauth`.
- Server-side OAuth launcher commit: `d1ecfe957dc26a87d8fd965e5d32f75ea7887043`.
- Runtime public-config fallback implementation is complete through commit `1ccd8c5850408e944a145ad899b4399f21f9ab01`.
- First-load Studio initialization fix: `242dda443247deba721d8ced1cc79a1e28373f5c`.
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
- Foreign-key index findings were repaired; remaining unused-index notices are expected on the new database.

### Authentication and runtime configuration
- Supabase Google provider is configured with the dedicated NestMetric Google Cloud OAuth client.
- Google OAuth initiation is server-side at `/auth/google`; the route uses the Supabase SSR client, creates the PKCE flow, and redirects to the provider.
- `/auth/callback` exchanges an OAuth code for the authenticated session and redirects to `/studio`.
- Live browser acceptance on 2026-08-20 confirmed `/auth/google` 307, Supabase Google authorization/callback, PKCE token exchange 200, NestMetric `/auth/callback` 307, and authenticated `/studio` execution.
- The login UI uses ordinary navigation to `/auth/google`; Google sign-in defaults enabled for this configured project and can be explicitly disabled with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`.
- Supabase clients use one shared runtime configuration module. Vercel environment variables override the dedicated NestMetric Supabase URL/publishable key; if an inline preview does not receive those runtime variables, the source contains safe project-specific fallbacks for the public URL and publishable key only.
- No Supabase secret/service-role key is stored in source or exposed to the browser.
- Email magic-link sign-in remains available as a fallback, but Supabase default SMTP has already hit its development email rate limit and is not considered production-ready mail infrastructure.

### v0.2.2 application state
- Supabase SSR runtime is wired to the dedicated project using the publishable key only; RLS remains authoritative.
- Studio exposes sign-out for authenticated sessions.
- Backend health route checks real Supabase connectivity and anonymous RLS non-disclosure.
- Canonical Room Model, Organize / Arrange / Build Studio, geometry/build gating, private Storage capture, planning persistence and measurement verification remain intact.

### Current corrected auth preview
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`)
- Preview deployment: `dpl_Gav7vNFJieWRmC523TAzb7y3yXDZ`
- Preview URL: `https://nestmetric-i4odlsfje-lew7.vercel.app`
- State: `READY`
- Inline preview package contains the current approved feature-branch runtime plus a deployment-only `vercel.json` framework override for Next.js.
- Vercel detected Next.js `16.3.1`; compilation and TypeScript passed.
- Built routes include `/auth/google`, `/auth/callback`, `/studio`, and `/api/health/backend`.
- The prior auth preview `dpl_4naqG1bEAea4CMJ1oS99jRkueYif` returned HTTP 500 on `/auth/google` because Vercel's inline deployment path did not expose project Preview environment variables to the serverless runtime. The shared public-config fallback resolves that runtime failure across browser, server, proxy, Studio and health-check Supabase clients.

### Authenticated starter persistence acceptance — 2026-08-20
- Google OAuth completed successfully in the current preview and established an authenticated Supabase session.
- First authenticated Studio execution inserted all expected starter data successfully: `1` project, `1` room, `3` room objects, `1` room opening, `0` measurements, `0` assets.
- Supabase API logs show all four starter insert operations returned HTTP `201`.
- The first Studio render then returned HTTP `500` with `Unable to initialize the Room Model.` despite successful persistence.
- Root cause: the page performs an empty room GET, writes the starter Room Model, then repeats the same room GET in the same Next.js render. The repeated GET was not sent to Supabase, consistent with same-request fetch memoization/reuse of the first empty result.
- Source fix `242dda443247deba721d8ced1cc79a1e28373f5c` now creates the starter Room Model and redirects to `/studio`, forcing a fresh request to load the persisted data.
- Existing persisted starter data means the already-authenticated preview should render Studio successfully on Reload even before a new preview containing the source fix is built.
- Remaining acceptance: confirm Studio renders after reload, then verify object movement persistence, real measurement persistence, private asset upload, and sign-out/sign-in persistence.

### Production state
The existing NestMetric production alias remains on the previously verified release. v0.2.2 will not be production-promoted until full authenticated persistence acceptance proves account/session, project/room persistence, object movement, measurement persistence, and private asset storage against Supabase.

### Known external constraints
- Vercel project-level framework configuration still reports `framework: null`; previews explicitly supply a Next.js framework override. This should be normalized before routine production releases.
- The current Vercel connector's inline deployment path does not reliably inherit project runtime environment variables; NestMetric therefore has safe public Supabase defaults while retaining environment overrides.
- Supabase default SMTP is suitable only for development/testing and has already rate-limited repeated magic-link attempts; production email auth requires custom SMTP if retained.

## Development workflow normalization — 2026-08-19
- GitHub `main` is now the canonical source of truth; normal development no longer reconstructs source from Vercel artifacts.
- Changes use `parallax/...` branches and PRs.
- Risk-scoped validation commands are available: `validate:ui`, `validate:domain`, `validate:full`, and `classify:change`.
- Normal release flow is: source change → scoped validation → one preview → live acceptance → merge/promotion.
- Vercel chunk/bootstrap source transport is retired for normal development. The connector can create inline-file previews from the canonical Git tree when direct Git-source deployment is unavailable.
