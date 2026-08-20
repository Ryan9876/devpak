# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Core photo-first workflow is functioning in Preview. Google OAuth, durable Room Model storage, private room-photo persistence, AI visual proposals, Geometry interaction, v4 mobile touch/zoom/pan, deterministic support/collision/gravity, and the v3 refinement derivative pipeline have all produced successful live evidence. The latest increment removes the full-page reload after refinement and is build-validated in a READY Preview. Refined visual quality and the new in-place transition still require live acceptance before production promotion.**

## Canonical source
- Repository: `Ryan9876/devpak`.
- Active branch: `parallax/object-interaction-v4`.
- Canonical `main` remains unchanged by this work.
- Current application source head: `15fed9669674c51760fbb4ddfac43190696a27cc`.
- Latest functional changes:
  - `695fc2b505b5ddd6466e7eb8e773a098d746f428` — remove invalid background-generation aspect-ratio request and add structured failure logging.
  - `e23134d55f69451de3f40fdddcefc38c32a50694` — align browser preparation timeout with server/provider limits.
  - `8fe4d57167a3bde3d2119f7de164d9e7c1f098f3` — reduce localized background-generation latency with GPT Image 2 medium quality, no SDK retry delay, and a 105 s provider ceiling.
  - `15fed9669674c51760fbb4ddfac43190696a27cc` — transition from basic to refined manipulation in place using returned signed derivative URLs instead of `window.location.reload()`.
- `src/components/PhotoWorkspaceCore.tsx` remains the accepted v4 interaction core and was not changed by the refinement-transition increment.
- Temporary Vercel bootstrap/config files are deployment-only and are not canonical application source artifacts.

## Product direction
- NestMetric is a **functional photo-augmentation product, not a CAD application**.
- The real room photo is the primary workspace for Organize, Arrange, and early Build exploration.
- The Room Model remains authoritative for geometry, constraints, measurements, verification, and Build readiness.
- AI visual proposals and localized background reconstruction are rendering/advisory layers; they do not replace deterministic geometry or persisted Room Model truth.

## Accepted backend and authentication baseline
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` is the durable source for room imagery and generated derivatives.
- Google OAuth live browser acceptance passed through `/auth/google` → Supabase Google OAuth/PKCE → `/auth/callback` → authenticated `/studio`.
- Starter Room Model persistence was confirmed live.

## Accepted source-photo baseline
- Accepted source asset: `59cab87c-055a-420b-9b7f-97bb678f7660`.
- Source image is JPEG, `2,202,043` bytes, persisted privately and survived reload/sign-out/sign-in.
- The calibrated source photo uses `capture_context.scene` with normalized image coordinates.
- Calibrated support surfaces: dresser top, bed, and floor.
- Movable item: plant.
- Fixed collision footprints include lamp, folded clothes, shoe boxes, and floor bag.
- Foreground bed occlusion is represented by the `bed-foreground` occluder mask.

## Geometry interaction
- Live-tested and accepted by the user as working.
- Exact grab-offset dragging, continuous motion, 50 mm snap on release, boundary clamping, conflict feedback, invalid-drop reversion, physical aspect ratio, and one durable write per valid release remain intact.
- Geometry remains a secondary precision view.

## Object Interaction v4
- Uses per-object gesture ownership rather than canvas-level DOM ancestry arbitration.
- A dedicated transparent responder owns one-finger object gestures immediately on pointer-down.
- Minimum screen-space hit target remains 44 px after viewport scaling.
- Dragging uses original-box + pointer-delta math; tapping selects without persisting.
- Invalid drops revert; unsupported drops continue through deterministic gravity.
- Empty-space pan, pinch, double-tap zoom, and explicit zoom controls remain canvas responsibilities.
- Native two-finger touch can override an active object responder for iOS viewport pinch without persisting the cancelled object move.
- User live testing previously reported improved finger selection/zoom/pan behavior; this interaction architecture remains protected from regression.

## Photo manipulation v3 — exact source pixels
- Source scene is version `2`, calibration `manual_v3`.
- Plant uses four persisted `sourceMasks` normalized to immutable `sourceBbox`; segmentation provenance is `manual_polygon_v3`.
- `/api/ai/photo-scene-assets` uses `sharp@0.34.3` to auto-orient the source, crop actual source pixels, and apply the persisted alpha masks.
- Valid plant derivative contract:
  - `captureMethod: scene_object_cutout`
  - `renderMode: exact_source_mask_v3`
- Valid background derivative contract:
  - `captureMethod: scene_background_plate`
  - `renderMode: localized_mask_inpaint_v3`
- Background reconstruction is localized to the plant area; pixels outside the local object mask remain sourced from the original photograph.
- Live dragging remains browser-side compositing with exact source pixels, support/collision/gravity, perspective-aware scaling, contact shadow, and calibrated foreground occlusion.

## Refinement pipeline — live success
The latency-reduced Preview successfully completed the full authenticated refinement flow on 2026-08-20:
- `/api/ai/photo-scene-assets/resolve` returned `200`.
- `/api/ai/photo-scene-assets` returned `200`.
- No refinement runtime errors were present after the successful request.
- Supabase now contains both required private derivatives for the accepted source photo:
  - Background asset `3a834786-c1b7-40bc-ab0f-70a7acbcc96b` — `scene_background_plate` / `localized_mask_inpaint_v3`, `2,973,316` bytes.
  - Plant asset `082cd10a-9a01-4c2c-a817-ce75a04fd3ac` — `scene_object_cutout` / `exact_source_mask_v3`, `341,815` bytes.
- The successful derivative creation proves the owner-scoped source resolver, AI background reconstruction, exact source-pixel extraction, private Storage upload, metadata persistence, and success response path work end to end.
- Because these derivatives now exist, subsequent opens of the accepted source photo should reuse them rather than regenerate them.

## Latest development increment — in-place refinement transition
`PhotoWorkspace.tsx` no longer performs `window.location.reload()` after a successful preparation request.
- The preparation route's returned signed background and object URLs are captured directly in local component state.
- The wrapper immediately re-renders `PhotoWorkspaceCore` with those returned derivative URLs and `refined=true`.
- This preserves the current Studio session instead of forcing Safari to reload the page after a potentially long first-run refinement.
- Basic manipulation remains available during preparation.
- Failure still falls back explicitly to Basic manipulation mode with Retry refinement.
- This change does not modify support/collision/gravity, scene coordinates, persisted object positions, viewport math, or the v4 interaction core.

## Current Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_Ctk6HwbuL2DXrDrBdUTQSKuhSW1a`.
- URL: `https://nestmetric-dxpnc87nb-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrap was pinned to immutable source commit `15fed9669674c51760fbb4ddfac43190696a27cc`.
- Full validation passed:
  - Release structure PASS.
  - Strict TypeScript PASS.
  - Room Model schema/RLS gate PASS.
  - Domain/interaction tests `10/10` PASS.
  - Next.js `16.3.1` production build PASS.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-scene-assets/resolve`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- `npm install` continues to report one high-severity dependency advisory; this increment did not alter dependencies and no forced upgrade has been applied without audit.

## Remaining acceptance gates
1. Open the current Preview on iPhone and confirm the accepted source photo enters the refined compositor without a full page reload.
2. Confirm the visual quality of the exact plant cutout and reconstructed background is materially better than the previous translucent/basic fallback.
3. Re-test finger drag, zoom/pan, dresser support, bed support, unsupported-drop gravity, and foreground occlusion in refined mode.
4. Do not promote to production until those visual/interaction checks pass.

## Production state
The existing NestMetric production alias remains on the previously verified older release. Current photo-first/direct-manipulation/refinement work is **not production-promoted**.

## Known platform constraints
- The long-lived Vercel project still reports `framework: null` and can inherit a stale `public` output-directory expectation. Preview deployments therefore use a deployment-only Next.js config override.
- Inline Preview deployment does not reliably inherit every project runtime environment variable; the current application uses the dedicated Supabase project configuration plus Vercel AI Gateway/OIDC for AI generation.
- Supabase default SMTP is not production-ready; Google OAuth remains the accepted authentication path unless custom SMTP is added.

## Development workflow
- Changes use `parallax/...` branches.
- Release flow: source change → scoped validation → Preview → live acceptance → merge/promotion.
- `CURRENT-STATE.md` is updated after meaningful validated deployments or material decisions.
- Durable architecture/design/governance records are updated only when their subject matter changes.
