# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; Geometry interaction live-accepted; private source-photo durability fully accepted; AI visual proposal generation/private persistence live-accepted; surface-aware direct photo manipulation v1 live-tested but visually too crude; refined photo manipulation v2 is source-complete and build-validated in a READY Preview, with live derivative preparation/visual-quality acceptance still pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`.
- Canonical `main` remains unchanged by this work.
- Active feature branch: `parallax/photo-manipulation-v2`, created from `parallax/surface-aware-photo-v1`.
- v2 runtime source validated in the current Preview is immutable commit `b14cb77c9259387ae6298712ce7cd3f3f31672aa`.
- Subsequent commits on the same branch update authoritative project records only; they do not change the validated v2 runtime code.
- Temporary Vercel bootstrap files are deployment-only and are not canonical source artifacts.

### Durable product direction — 2026-08-20
- NestMetric is explicitly governed as a **functional photo-augmentation product, not a CAD application**.
- The real room photo is the primary user-facing workspace for Organize, Arrange, and early Build exploration.
- The canonical Room Model remains authoritative for geometry, constraints, measurement evidence, persistence, and Build readiness, but is surfaced as a secondary Geometry view when precision matters.
- Direct photo manipulation has its own calibrated normalized image-space scene contract and does not pretend measured top-down coordinates are already projected into a perspective photograph.
- AI-generated visual proposals and AI-generated manipulation derivatives are advisory/rendering assets. They never mutate measured coordinates, measurement evidence, deterministic support rules, or Build readiness.

### Durable backend
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`, previously confirmed `ACTIVE_HEALTHY`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` remains the durable source for room imagery and generated derivatives.
- Source room photos use `captureMethod: guided_web_photo`.
- Visual proposals use `captureMethod: ai_photo_proposal`.
- Refined manipulation derivatives use `captureMethod: scene_background_plate` and `captureMethod: scene_object_cutout` and reference the source asset rather than replacing it.
- All source/generated assets remain owner-scoped/private; browser display uses short-lived signed URLs.

### Authentication and starter persistence
- Google OAuth live browser acceptance passed through server-side `/auth/google`, Supabase Google OAuth/PKCE, `/auth/callback`, and authenticated `/studio`.
- First authenticated Studio initialization persisted the expected starter state: `1` project, `1` room, `3` room objects, `1` opening.
- The original same-render first-load reload defect was fixed by redirecting to a fresh `/studio` request after starter creation.

### Geometry interaction acceptance
- The user live-tested the refined Geometry drag interaction and reported: **“It works.”**
- Geometry retains exact grab-offset dragging, continuous motion, release-time 50 mm snap, boundary clamping, contextual conflicts, invalid-drop reversion, true physical aspect ratio, and one final durable write per valid release.
- Geometry remains a secondary precision utility rather than the main product metaphor.

### Source-photo durability acceptance
- Live user upload succeeded.
- Supabase confirms the source photo is a durable private `room_assets` row and matching `room-assets` Storage object.
- Accepted source asset id: `59cab87c-055a-420b-9b7f-97bb678f7660`.
- Source image is JPEG, `2,202,043` bytes, associated with the authenticated room/owner.
- The photo survived page reload and sign-out/sign-in, closing the account-level source-photo persistence gate.

### AI visual proposal acceptance
- The photo proposal path uses AI SDK `generateImage()` with `openai/gpt-image-2` through Vercel AI Gateway/OIDC, avoiding a source-stored or inherited OpenAI provider key.
- Live generation succeeded after the Gateway change. Supabase confirms a private AI proposal row/object linked to the accepted source photo with `captureMethod: ai_photo_proposal`, model `openai/gpt-image-2`, and gateway `vercel_ai_gateway`.
- Accepted generated proposal asset id: `1ae12441-c643-4e63-9a92-19117ed33c42`.
- The user viewed the generated visual proposal in Studio. This closes Gateway execution and private proposal persistence; visual usefulness remains iterative product work rather than a connectivity blocker.
- The proposal route now explicitly filters source photos so later background/cutout derivatives cannot accidentally become the input source for new proposals.

### Surface-aware direct photo manipulation v1
- The source photo has a durable `PhotoScene` calibration in `capture_context.scene` using normalized image coordinates.
- Current calibrated support surfaces: dresser top, bed, and floor.
- Current movable item: plant.
- Current fixed collision footprints include the lamp, folded clothes, shoe boxes, and floor bag.
- Deterministic support/collision/gravity behavior is implemented and domain-tested: supported placement, same-surface blockers, nearest-clear placement, and unsupported release to the next lower valid support.
- The user live-tested the v1 interaction and reported: **“It’s very crude but it’s a start.”** The interaction model is therefore retained, while the crop-based visual compositor is explicitly superseded by v2.
- The current source photo also carries a `bed-foreground` occluder mask that hides floor-level objects behind the foreground bed region.

### Refined photo manipulation v2
- Active branch: `parallax/photo-manipulation-v2`.
- New authenticated route: `/api/ai/photo-scene-assets`.
- Scene preparation is idempotent and owner-scoped. It prepares/reuses two private derivatives for the calibrated movable plant:
  - clean background plate generated with `openai/gpt-image-2`, removing only the plant while preserving the photographed scene;
  - transparent plant cutout generated with `openai/gpt-image-1.5`, because GPT Image 2 does not support transparent-background output.
- Studio distinguishes source photos, visual proposals, background plates, and cutouts. Internal derivatives do not enter the user-facing photo filmstrip and cannot become source inputs accidentally.
- Direct manipulation is anchored to the original calibrated photo. Generated proposals are view-only.
- Once derivatives exist, browser compositing uses clean background + transparent cutout + deterministic support/collision/gravity + perspective-aware scale + support-dependent contact shadow + calibrated foreground occlusion.
- The old softened rectangular crop remains only as a temporary fallback until derivative preparation succeeds.
- Selection treatment is intentionally subtle; persistent object-name pills/heavy boxes are not part of the refined target interaction.
- **Live v2 derivative preparation and visual-quality acceptance are still pending.** No derivative asset is recorded as generated until the authenticated preparation route succeeds and Supabase confirms both private derivative objects/rows.

### Current v2 Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_54zzMFwKNBLaCwEZXo2cr5duEmxV`.
- URL: `https://nestmetric-nty3l4ztq-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrapped immutable canonical GitHub runtime commit `b14cb77c9259387ae6298712ce7cd3f3f31672aa` instead of manually reconstructing the source tree.
- Bootstrap verification confirmed the refined compositor and Studio preparation integration were present before validation.
- Domain validation passed `6/6`: existing Room Model tests plus photo support, collision, and gravity tests.
- Next.js `16.3.1` production compilation passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Automated path fetching remains limited by Vercel Preview Protection and is not treated as evidence of application failure.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first/direct-manipulation work is **not production-promoted**. Production promotion remains gated on live v2 manipulation acceptance and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; Preview deployments explicitly supply a Next.js framework override. This should be normalized before routine production releases.
- The Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; AI generation avoids an inherited OpenAI provider key through Vercel AI Gateway/OIDC.
- Supabase default SMTP is not production-ready and has already rate-limited email magic-link testing; Google OAuth is the accepted auth path unless custom SMTP is added later.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
- Preview validation may use a deployment-only bootstrap pinned to an immutable canonical GitHub commit so the build tests exact source without hand-copying the runtime tree.
