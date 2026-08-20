# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; refined Geometry interaction live-accepted by the user; photo-first Studio implemented and build-validated in a READY Preview; private source-photo upload acceptance passed; reload/sign-in persistence and AI visual-proposal acceptance still pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical `main` head before the active auth/UX work: `b0800d7ba379912f703ec322fab24ae08d4be436`.
- Active feature branch: `parallax/photo-first-studio`, based on the accepted auth/Studio-refinement branch.
- Photo proposal API route: `895f9429a076a24d688135f7a097d67a827eb6ad`.
- Photo-first Studio: `56b9fdd0596daccb4102f0590c4c04a24673cd45`.
- Photo-first Studio visual system: `1220b58b287950f967d2602833a92ec66ca6e701`.
- Photo-first landing direction: `e210df4ab01d33687957703c95ef8dbbe4d2a98f`; supporting landing stylesheet `15b5dbf88f076e3513fdff8893cd9eb58777c6bc`; layout/metadata `0eb94306207254a42adab4379ad666d7a110f315`.
- Temporary Vercel/bootstrap source artifacts are not part of the canonical tree.

### Durable product direction — 2026-08-20
- NestMetric is explicitly governed as a **functional photo-augmentation product, not a CAD application**.
- The real room photo is the primary user-facing workspace for Organize, Arrange, and early Build exploration.
- The canonical Room Model remains authoritative for geometry, constraints, measurement evidence, persistence, and Build readiness, but is surfaced as a secondary Geometry view when precision matters.
- AI-generated visual proposals are separate advisory assets. They do not mutate measured coordinates, measurements, constraints, or Build readiness and must remain visibly distinguishable from the original photo.
- A top-down Room Model is not treated as calibrated to a perspective photo without explicit calibration/projection evidence.

### Durable backend
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`, state previously confirmed `ACTIVE_HEALTHY`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` remains the durable source for room imagery.
- Existing `room_assets.capture_context` supports source-photo and AI-proposal classification without a schema migration.
- Source room photos use `captureMethod: guided_web_photo`.
- Generated visual proposals use `captureMethod: ai_photo_proposal` plus source asset id, mode, goal, model, and generation timestamp.
- Source and generated assets remain owner-scoped/private; clients receive short-lived signed URLs.

### Authentication and starter persistence
- Google OAuth is configured and live browser acceptance passed through server-side `/auth/google`, Supabase Google OAuth/PKCE, `/auth/callback`, and authenticated `/studio`.
- First authenticated Studio initialization persisted the expected starter state: `1` project, `1` room, `3` room objects, `1` opening.
- The original same-render first-load reload defect was fixed by redirecting to a fresh `/studio` request after starter creation.
- Authenticated Studio rendering was subsequently confirmed.

### Geometry interaction acceptance
- The user live-tested the refined drag interaction and reported: **“It works.”**
- Geometry retains exact grab-offset dragging, continuous motion, release-time 50 mm snap, boundary clamping, contextual conflicts, invalid-drop reversion, true physical aspect ratio, and one final durable write per valid release.
- Geometry is retained as a secondary precision utility in the photo-first product rather than removed.

### Photo-first Studio implementation
- Studio defaults to `Photo`, with `Geometry` as the secondary view.
- With no room photo, the central workspace asks the user to take/choose a private room photo rather than presenting a plan first.
- Source photos are uploaded to private Supabase Storage with durable `room_assets` metadata.
- The photo workspace displays the original image and a filmstrip/history of generated visual proposals.
- Generated images are explicitly labeled `Visual proposal` and display a concept disclaimer that measured geometry remains authoritative.
- Organize / Arrange / Build remain top-level modes; the photo goal describes the desired functional outcome rather than CAD operations.
- The landing page and metadata now describe functional photo augmentation instead of floor planning/CAD.

### Private source-photo acceptance — 2026-08-20
- Live user upload succeeded in the photo-first Preview.
- Supabase confirms one durable `room_assets` row for the authenticated room with `captureMethod: guided_web_photo`.
- The corresponding object exists in the `room-assets` Storage bucket at the exact metadata path.
- Uploaded asset is JPEG, `2,202,043` bytes, and associated with the authenticated room/owner.
- Storage bucket `room-assets` is confirmed `public=false`, has a `15 MiB` limit, and permits JPEG/PNG/WebP/HEIC.
- Current room asset classification is `1` source photo and `0` AI visual proposals.
- This closes the private upload/storage-object linkage gate. Remaining photo acceptance: confirm the source image survives page reload and sign-out/sign-in in the UI.

### Photo proposal generation path
- New authenticated route: `/api/ai/photo-proposal`.
- The route reads the authenticated owner's private source photo, requests a high-fidelity image edit using GPT Image 2 by default, persists the output back to private `room-assets`, records proposal metadata, and returns a short-lived signed URL.
- Prompts explicitly preserve camera viewpoint, architecture, perspective, scale, occlusion, lighting direction, and recognizable room surfaces and prohibit CAD drawings, floor plans, diagrams, labels, dimensions, or watermarks.
- Provider credentials remain server-only and are never stored in source.
- **Live AI image generation is not yet accepted.** The current Vercel inline Preview mechanism has previously failed to inherit project runtime environment variables; unlike the public Supabase publishable key, `OPENAI_API_KEY` cannot and will not be source-defaulted. The route will return a controlled configuration error if the credential is unavailable.
- Vercel AI Gateway was evaluated as a potential secretless/OIDC path. Although GPT Image 2 generation is supported, current evidence does not establish a reliable `/images/edits` upload/edit equivalent for this exact source-photo editing workflow, so the implementation remains on the direct OpenAI Image Edit API until an equivalent edit path is verified.

### Current photo-first Preview
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_EQK4ttW1UzJ2MQXeEBuMefs4nY1S`.
- URL: `https://nestmetric-6t1a3l333-lew7.vercel.app`.
- State: `READY`.
- Preview only; no production aliases were changed.
- Vercel detected Next.js `16.3.1`.
- Production compile passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Live acceptance still required for: photo persistence across reload/sign-in and AI visual proposal generation/private persistence.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first work is **not production-promoted**. Production promotion remains gated on live photo-first acceptance plus the remaining authenticated persistence checks and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; inline Previews explicitly supply a Next.js framework override. This should be normalized before routine production releases.
- The current Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; secrets do not.
- Supabase default SMTP is not production-ready and has already rate-limited email magic-link testing; Google OAuth is the accepted auth path unless custom SMTP is added later.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
