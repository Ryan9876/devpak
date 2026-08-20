# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; Geometry interaction live-accepted; private source-photo durability accepted; AI visual proposal generation/private persistence live-accepted; surface-aware direct photo manipulation v1/v2 were visually insufficient; v3 exact-pixel manipulation remains live-acceptance pending; mobile viewport zoom/pan is build-validated and live use improved; Object Interaction v4 has been live-tested as better for finger selection/zoom/pan; automatic refined-scene preparation is now build-validated in a READY Preview with live derivative creation pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`.
- Canonical `main` remains unchanged by this work.
- Active feature branch: `parallax/object-interaction-v4`, created from `parallax/photo-viewport-zoom-pan`.
- Automatic-refinement runtime commit validated in the current Preview: `3729f9bac347891c335b1efd1b821004510b7758`.
- The validated v4 interaction implementation is preserved byte-for-byte in `src/components/PhotoWorkspaceCore.tsx`; `src/components/PhotoWorkspace.tsx` is now a thin preparation controller around that core.
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
- Before the automatic-refinement pass, Supabase contained zero `scene_object_cutout` and zero `scene_background_plate` rows for the accepted source photo; only the original source and AI visual proposals existed. This confirmed the earlier screenshots were using the fallback crop renderer rather than v3.

### Photo viewport zoom/pan
- Viewport state is `{scale, tx, ty}` with clamped zoom range `1x..5x` and a `2.5x` double-tap target.
- Zoom and pan operate above the normalized photo-scene model; they do not mutate support surfaces, collision footprints, gravity, measurements, or persisted scene coordinates.
- Screen touches are inverse-transformed through the viewport before object drag/physics calculations.
- iOS/Safari uses native non-passive touch listeners for pinch because the earlier Pointer-Event-only pinch path did not engage reliably in live iPhone testing.
- Pointer Events remain available for desktop navigation and object interaction.
- A persistent compact `− / live scale / +` control is available even at `1x`; Reset appears above `1x` as a guaranteed fallback to browser gesture delivery.
- The user subsequently reported the interaction was **“better working with using my finger and zoom pan”** while the viewport was visibly zoomed, so the navigation/selection architecture is materially improved even though visual refinement is still pending.

### Object Interaction v4 — FormShift-derived responder model
- FormShift review showed that its reliable selection comes primarily from **per-object gesture ownership**, not a more complex global hit-test algorithm.
- NestMetric separates object rendering from object interaction. The visible photo object is non-interactive; a dedicated transparent responder is positioned over each movable object's photo-space footprint.
- The responder selects and claims a one-finger gesture immediately on pointer-down. The photo canvas no longer uses `target.closest('[data-photo-item-id]')` or other DOM-ancestry heuristics to decide which object the user intended to touch.
- The responder keeps at least a 44px screen-space hit target. The CSS-space minimum is divided by current viewport scale so zoom does not inflate the hit region into an oversized screen-space target.
- Object movement records the original box and normalized starting pointer once, then computes position from pointer delta via `src/lib/photo/interaction.ts`.
- A simple tap selects but does not persist. Drag movement is transient/local until release; a successful release performs one durable scene write.
- Invalid release reverts to the starting state. Unsupported release continues through NestMetric's deterministic gravity resolver.
- The canvas owns only viewport concerns: pinch, empty-space pan, double-tap zoom, and explicit zoom controls.
- Native two-finger touch overrides an active object responder on iOS: the object move is cancelled/reverted and viewport pinch takes over without persisting the cancelled move.
- The user live-tested this responder build and reported improved finger/zoom/pan behavior. Selection mechanics are therefore accepted as directionally successful; further work should not regress back to canvas-level object arbitration.

### Automatic refined-scene preparation
- `PhotoWorkspaceCore.tsx` preserves the validated v4 interaction implementation unchanged.
- `PhotoWorkspace.tsx` now acts as a preparation controller around that core.
- When a calibrated Original photo has source masks but lacks refined derivatives, the wrapper automatically enters **Preparing room objects…** instead of presenting the crude crop as normal interaction.
- The wrapper extracts the exact private Storage object path from the signed source URL, then calls `/api/ai/photo-scene-assets/resolve`.
- The resolver is authenticated and owner-scoped; it maps that exact `object_path` to the authoritative `roomId`, `sourceAssetId`, and movable `itemId`. It does not guess from the user's newest photo.
- The browser then calls the existing idempotent `/api/ai/photo-scene-assets` route. Existing v3 derivatives are reused; missing derivatives are created once.
- Successful preparation reloads Studio so refreshed private signed URLs are used by the refined compositor.
- If preparation genuinely fails, the working v4 fallback remains available but is explicitly labeled **Basic manipulation mode** with a **Retry refinement** action. Silent fallback is no longer treated as target quality.
- Live authenticated derivative creation is still pending; build success does not yet prove the current room's exact cutout/background assets were generated.

### Current automatic-refinement Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_9xfNSaMybHJdqxiZXNphWFW52JT6`.
- URL: `https://nestmetric-j1ytfpbc9-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrapped immutable runtime commit `3729f9bac347891c335b1efd1b821004510b7758`.
- Bootstrap verification confirmed the automatic preparation wrapper, retry state, frozen v4 interaction core, and owner-scoped resolver were present before validation.
- Domain validation passed `10/10`: Room Model/photo support/collision/gravity, viewport mapping/zoom/clamping, and object pointer-delta behavior.
- Next.js `16.3.1` production compilation passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-scene-assets/resolve`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Live acceptance criterion: opening the calibrated Original should automatically show preparation, create/reuse private `scene_background_plate` and `scene_object_cutout` assets, reload into **Refined manipulation**, and preserve v4 finger/zoom/pan/gravity behavior.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first/direct-manipulation work is **not production-promoted**. Production promotion remains gated on live v3/refinement acceptance and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; Preview deployments explicitly supply a Next.js framework override.
- The Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; AI generation uses Vercel AI Gateway/OIDC rather than an inherited OpenAI provider key.
- Supabase default SMTP is not production-ready; Google OAuth is the accepted auth path unless custom SMTP is added later.
- `npm install` previously surfaced one high-severity dependency advisory during Preview validation. The interaction/refinement work did not modify package dependencies, so this remains a separate dependency-audit item.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
- Preview validation may use a deployment-only bootstrap pinned to an immutable canonical GitHub commit so the build tests exact source without hand-copying the runtime tree.
