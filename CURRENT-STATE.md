# NestMetric Current State

## v0.2.2 Phase 2 durable-backend release candidate
Status: **canonical Git source established on `main`; dedicated Supabase backend provisioned/migrated; Google OAuth live acceptance passed; starter Room Model persistence and authenticated Studio rendering confirmed; Studio interaction/visual refinement preview built and READY; full persistence acceptance still in progress; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical `main` head before this auth/refinement work: `b0800d7ba379912f703ec322fab24ae08d4be436`.
- Active feature branch: `parallax/server-google-oauth`.
- Server-side OAuth launcher commit: `d1ecfe957dc26a87d8fd965e5d32f75ea7887043`.
- Runtime public-config fallback implementation is complete through commit `1ccd8c5850408e944a145ad899b4399f21f9ab01`.
- First-load Studio initialization fix: `242dda443247deba721d8ced1cc79a1e28373f5c`.
- Studio direct-manipulation refinement: `542921bcbfb0eb77534e92f9124d11ffaeac0589`.
- Studio visual hierarchy refinement: `b7575b82d183434db8960adefc6f849c2a853f12`.
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

### Authenticated starter persistence acceptance — 2026-08-20
- Google OAuth completed successfully and established an authenticated Supabase session.
- First authenticated Studio execution inserted all expected starter data successfully: `1` project, `1` room, `3` room objects, `1` room opening, `0` measurements, `0` assets.
- Supabase API logs show all starter insert operations returned HTTP `201`.
- The original first Studio render returned HTTP `500` with `Unable to initialize the Room Model.` despite successful persistence.
- Root cause: the page performed an empty room GET, wrote the starter Room Model, then repeated the same room GET in the same Next.js render. The repeated GET was not sent to Supabase, consistent with same-request fetch memoization/reuse of the first empty result.
- Source fix `242dda443247deba721d8ced1cc79a1e28373f5c` now creates the starter Room Model and redirects to `/studio`, forcing a fresh request to load persisted data.
- Live browser reload subsequently rendered the authenticated `Main room` Studio successfully using the durable Supabase-backed Room Model.

### Studio interaction and visual refinement
- Dragging now preserves the exact pointer grab offset; movable objects no longer jump to their center when picked up.
- Pointer motion is continuous and unsnapped while dragging. The 50 mm grid is applied only on release.
- Movement is clamped to room bounds during drag; fixed/opening conflicts are previewed contextually.
- Invalid releases revert to the original persisted position instead of silently stopping mid-drag.
- Valid releases perform deterministic placement validation and persist exactly the final snapped coordinates once.
- The room canvas preserves the Room Model's physical aspect ratio instead of independently stretching X/Y geometry.
- Visual states now distinguish selected, fixed, dragging and invalid placement; the dragging object receives lift/grab feedback.
- Capture and Measurements moved behind progressive disclosure; object list and inspector are visually quieter so the floor plan is the primary working surface.
- Stale status/conflict messages clear when selection or workspace mode changes.

### Current Studio-refinement preview
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`)
- Preview deployment: `dpl_E7zgQ1SEdpoiw8ngGm6RpmA7phGE`
- Preview URL: `https://nestmetric-g2t2m5xrm-lew7.vercel.app`
- State: `READY`
- Preview was built from the exact approved feature-branch runtime using a 29-file inline package plus a Next.js framework override; production aliases were not changed.
- Vercel detected Next.js `16.3.1`; compile and TypeScript completed successfully.
- Built routes include `/auth/google`, `/auth/callback`, `/studio`, and `/api/health/backend`.
- Live UX acceptance of the refined drag feel and layout is still pending user evaluation.

### Production state
The existing NestMetric production alias remains on the previously verified release. v0.2.2 will not be production-promoted until full authenticated persistence acceptance proves account/session, project/room persistence, object movement, measurement persistence, and private asset storage against Supabase, and the refined Studio interaction receives live acceptance.

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
