# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; Geometry interaction live-accepted; private source-photo durability accepted; AI visual proposal generation/private persistence live-accepted; surface-aware direct photo manipulation v1/v2 were visually insufficient; v3 exact-pixel manipulation remains live-acceptance pending; photo viewport zoom/pan is source-complete and build-validated in a READY Preview, with live iPhone gesture acceptance pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`.
- Canonical `main` remains unchanged by this work.
- Active feature branch for this interaction pass: `parallax/photo-viewport-zoom-pan`, created from `parallax/photo-manipulation-v3`.
- Zoom/pan runtime commit validated in the current Preview: `be27f5e6c591f88bfe4548003278c4385046a87a`.
- Subsequent commits on the branch update authoritative records only and do not change that validated runtime package.
- Temporary Vercel bootstrap files are deployment-only and are not canonical source artifacts.

### Durable product direction — 2026-08-20
- NestMetric is a **functional photo-augmentation product, not a CAD application**.
- The real room photo is the primary user-facing workspace for Organize, Arrange, and early Build exploration.
- The canonical Room Model remains authoritative for geometry, constraints, measurement evidence, persistence, and Build readiness, but is surfaced as a secondary Geometry view when precision matters.
- Direct photo manipulation uses a calibrated normalized image-space scene contract.
- AI visual proposals and background reconstruction are rendering/advisory layers only; deterministic placement and measured Room Model truth remain authoritative.

### Durable backend and authentication
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` remains the durable source for room imagery and generated derivatives.
- Google OAuth live browser acceptance passed through server-side `/auth/google`, Supabase Google OAuth/PKCE, `/auth/callback`, and authenticated `/studio`.
- First authenticated Studio initialization persisted the expected starter state: `1` project, `1` room, `3` room objects, `1` opening.

### Accepted photo workflow
- Accepted source asset id: `59cab87c-055a-420b-9b7f-97bb678f7660`.
- Source image is JPEG, `2,202,043` bytes, associated with the authenticated room/owner.
- The source photo survived reload and sign-out/sign-in.
- AI visual proposal generation through Vercel AI Gateway/OIDC succeeded and persisted privately.
- Earlier accepted proposal asset id: `1ae12441-c643-4e63-9a92-19117ed33c42`.
- A later proposal asset `790821d8-cdfd-4f03-aa5a-f302e00f6a9f` was also generated before the latest v3 correction test.

### Geometry interaction acceptance
- The user live-tested the refined Geometry drag interaction and reported: **“It works.”**
- Geometry retains exact grab-offset dragging, continuous motion, release-time 50 mm snap, boundary clamping, contextual conflicts, invalid-drop reversion, true physical aspect ratio, and one durable write per valid release.
- Geometry remains a secondary precision utility.

### Surface-aware direct photo manipulation
- The source photo has a durable `PhotoScene` calibration in `capture_context.scene` using normalized image coordinates.
- Calibrated support surfaces: dresser top, bed, and floor.
- Movable item: plant.
- Fixed collision footprints include the lamp, folded clothes, shoe boxes, and floor bag.
- Deterministic support/collision/gravity behavior is implemented and domain-tested.
- The current source photo carries a `bed-foreground` occluder mask that hides floor-level objects behind the foreground bed region.
- The user live-tested v1 and reported **“It’s very crude but it’s a start.”** v2 improved compositing only slightly, so crop-based and AI-recreated live-object rendering are superseded by v3.

### Photo manipulation v3 — exact source pixels
- The current source-photo scene is version `2`, calibration `manual_v3`, while preserving the user's last accepted plant support state.
- The plant carries four calibrated `sourceMasks` normalized to its immutable `sourceBbox` plus segmentation provenance `manual_polygon_v3`.
- `/api/ai/photo-scene-assets` uses pinned `sharp@0.34.3` to auto-orient the source photo, crop the **actual source pixels**, and apply the calibrated alpha masks, producing a private transparent PNG with `captureMethod: scene_object_cutout` and `renderMode: exact_source_mask_v3`.
- The live draggable plant is not recreated by an image model.
- Background preparation uses localized masked inpainting rather than whole-frame generation. Valid v3 backgrounds use `captureMethod: scene_background_plate` and `renderMode: localized_mask_inpaint_v3`; pixels outside the localized object mask remain sourced from the original photograph.
- Live dragging remains browser-side compositing with exact source pixels, deterministic support/collision/gravity, perspective-aware scale, contact shadow, and calibrated foreground occlusion.
- iOS/Safari native image callouts/context menus are suppressed on the manipulation surface.
- Visual Proposals are explicitly view-only and direct users back to `Original` for manipulation.
- Live v3 derivative preparation and final edge/background visual-quality acceptance remain pending.

### Photo viewport zoom/pan pass
- New pure viewport helper: `src/lib/photo/viewport.ts`.
- Viewport state is `{scale, tx, ty}` with clamped zoom range `1x..5x` and a `2.5x` double-tap target.
- Zoom and pan operate above the normalized photo-scene model; they do not mutate support surfaces, collision footprints, gravity, measurements, or persisted scene coordinates.
- Screen touches are inverse-transformed through the viewport before object drag/physics calculations, preserving normalized photo-space correctness while zoomed and panned.
- Gesture priority is explicit:
  - two fingers always own pinch zoom/pan;
  - one finger beginning on a movable object owns object manipulation;
  - one finger on empty photo space pans only when zoomed;
  - double-tap empty photo space toggles `1x` / `2.5x`.
- A second finger appearing during an object drag cancels/reverts that object move and transfers control to the viewport gesture.
- A simple object tap does not generate a persistence write.
- Small objects receive a minimum 44px invisible interaction target without changing their visible segmentation, scene footprint, or rendered size.
- While zoomed, a lightweight scale/reset control is shown; resetting to `1x` recenters the photograph.

### Current zoom/pan Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_5FnoLHLpUdHVRmHhfNvHdFGyaEZS`.
- URL: `https://nestmetric-p136dpqho-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrapped immutable runtime commit `be27f5e6c591f88bfe4548003278c4385046a87a`.
- Domain validation passed `9/9`: the existing six Room Model/photo support/collision/gravity tests plus three viewport tests covering inverse coordinate mapping, anchored zoom, and translation clamping.
- Next.js `16.3.1` production compilation passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Live iPhone acceptance for pinch, pan, double-tap, reset, and object dragging while zoomed is still pending.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first/direct-manipulation work is **not production-promoted**. Production promotion remains gated on live v3/viewport acceptance and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; Preview deployments explicitly supply a Next.js framework override.
- The Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; AI generation uses Vercel AI Gateway/OIDC rather than an inherited OpenAI provider key.
- Supabase default SMTP is not production-ready; Google OAuth is the accepted auth path unless custom SMTP is added later.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
- Preview validation may use a deployment-only bootstrap pinned to an immutable canonical GitHub commit so the build tests exact source without hand-copying the runtime tree.
