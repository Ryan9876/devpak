# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; refined Geometry interaction live-accepted by the user; private source-photo durability fully accepted; Vercel AI Gateway photo-edit path implemented and build-validated in a READY Preview; live AI visual-proposal acceptance still pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`
- Canonical `main` head before the active auth/UX work: `b0800d7ba379912f703ec322fab24ae08d4be436`.
- Active feature branch: `parallax/photo-first-studio`, based on the accepted auth/Studio-refinement branch.
- Initial photo proposal API route: `895f9429a076a24d688135f7a097d67a827eb6ad`.
- Photo-first Studio: `56b9fdd0596daccb4102f0590c4c04a24673cd45`.
- Photo-first Studio visual system: `1220b58b287950f967d2602833a92ec66ca6e701`.
- Photo-first landing direction: `e210df4ab01d33687957703c95ef8dbbe4d2a98f`; supporting landing stylesheet `15b5dbf88f076e3513fdff8893cd9eb58777c6bc`; layout/metadata `0eb94306207254a42adab4379ad666d7a110f315`.
- AI SDK dependency pinned for image editing: `5e2140c8630ddea745b071a85bf515e27dbfbc1c` (`ai@7.0.66`).
- Photo proposal route switched to Vercel AI Gateway reference-image editing: `57dc8adf5f1b4281d8589d89647339d16751d3f4`.
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
- Generated visual proposals use `captureMethod: ai_photo_proposal` plus source asset id, mode, goal, model, gateway, and generation timestamp.
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
- The landing page and metadata describe functional photo augmentation instead of floor planning/CAD.

### Private source-photo acceptance — 2026-08-20
- Live user upload succeeded in the photo-first Preview.
- Supabase confirms one durable `room_assets` row for the authenticated room with `captureMethod: guided_web_photo`.
- The corresponding object exists in the `room-assets` Storage bucket at the exact metadata path.
- Uploaded asset is JPEG, `2,202,043` bytes, and associated with the authenticated room/owner.
- Storage bucket `room-assets` is confirmed `public=false`, has a `15 MiB` limit, and permits JPEG/PNG/WebP/HEIC.
- Current accepted room asset classification before AI proposal generation is `1` source photo and `0` AI visual proposals.
- Live browser reload acceptance passed: the original private source photo reappeared after a Studio page reload.
- Live sign-out/sign-in acceptance passed: after ending the authenticated session and signing back in with Google, the same private source photo reappeared under the same account/room.
- This closes the private source-photo durability gate across upload, durable storage linkage, page reload, and account re-authentication.

### Photo proposal generation path
- Authenticated route: `/api/ai/photo-proposal`.
- The first live generation attempt on Preview `dpl_EQK4ttW1UzJ2MQXeEBuMefs4nY1S` returned the controlled message `Photo generation is not configured for this deployment.` Runtime logs confirm HTTP `503` from the route because the inline Preview did not receive `OPENAI_API_KEY`.
- Rather than add or source-default a provider secret, the implementation was changed to AI SDK `generateImage()` using `openai/gpt-image-2` through Vercel AI Gateway.
- The authenticated server downloads the private source photo from Supabase and supplies its bytes as a reference image together with the NestMetric edit prompt.
- Vercel-hosted Gateway authentication is designed to use short-lived deployment OIDC rather than an OpenAI API key in source/runtime configuration.
- Generated bytes remain destined for the private `room-assets` bucket and a durable owner-scoped `room_assets` row with `captureMethod: ai_photo_proposal`, source asset id, mode, goal, model, gateway, and generation time.
- Prompts explicitly preserve camera viewpoint, architecture, perspective, scale, occlusion, lighting direction, and recognizable room surfaces and prohibit CAD drawings, floor plans, diagrams, labels, dimensions, watermarks, borders, or UI.
- **Live AI image generation is still pending.** Successful build/route creation proves integration compatibility, not that Gateway OIDC/model execution or output quality has passed live acceptance.

### Current Gateway photo-edit Preview
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_DLRp4GEX1Y75D6Jag6CKHjJAr5L6`.
- URL: `https://nestmetric-b11oe0a57-lew7.vercel.app`.
- State: `READY`.
- Preview only; no production aliases were changed.
- Exact inline package contained 30 current build/runtime files plus a deployment-only Next.js framework override.
- Vercel installed the new AI SDK dependency, detected Next.js `16.3.1`, and completed production compilation successfully.
- TypeScript completed successfully.
- Built routes include `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Live acceptance still required for Gateway image execution, generated private asset persistence, source-to-proposal linkage, and visual usefulness.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first work is **not production-promoted**. Production promotion remains gated on live photo-first acceptance plus the remaining authenticated persistence checks and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; inline Previews explicitly supply a Next.js framework override. This should be normalized before routine production releases.
- The current Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; secrets do not. The photo-generation path now avoids relying on an inherited OpenAI provider key by using Vercel AI Gateway/OIDC.
- Supabase default SMTP is not production-ready and has already rate-limited email magic-link testing; Google OAuth is the accepted auth path unless custom SMTP is added later.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
