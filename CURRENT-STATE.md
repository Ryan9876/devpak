# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **The photo-first backend, authentication, Room Model, private source-photo storage, visual proposals, Geometry interaction, v4 mobile drag/zoom/pan, deterministic support/collision/gravity, and first-run derivative generation all have successful live evidence. The latest visual acceptance screenshot proved that the old manual movable-object calibration selected the wrong source pixels, so hard-coded “plant” identity has been superseded by a user-tap + vision-assisted object-selection contract. That replacement is build-validated in a READY Preview and now requires live mobile acceptance. Production remains unchanged.**

## Canonical source
- Repository: `Ryan9876/devpak`.
- Active branch: `parallax/object-interaction-v4`.
- Canonical `main` remains unchanged.
- Current application source validated in Preview: `aa004bc19e9e9c37be3826f9349bdd3c2b6a0d42`.
- Durable architecture update: `4d496593863725aacc4453aaf4df9b643a78a2da`.
- `src/components/PhotoWorkspaceCore.tsx` remains the accepted v4 drag/zoom/pan/physics implementation and was not modified by the object-selection increment.
- Deployment-only bootstrap/config files are not canonical application source artifacts.

## Product direction
- NestMetric is a **functional photo-augmentation product, not a CAD application**.
- The immutable real room photo is the primary visual workspace.
- The Room Model remains authoritative for geometry, measurements, constraints, verification, and Build readiness.
- AI may identify a user-selected photographed object and reconstruct pixels hidden behind it, but deterministic support/collision/gravity remains authoritative for movement.
- Live movable-object appearance continues to come from the original source photograph; image generation does not recreate the draggable object.

## Accepted backend/auth baseline
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` is the durable store for source photos and derivatives.
- Google OAuth live browser acceptance passed through `/auth/google` → Supabase Google OAuth/PKCE → `/auth/callback` → authenticated `/studio`.
- Starter Room Model persistence was confirmed live.

## Accepted source-photo baseline
- Source asset: `59cab87c-055a-420b-9b7f-97bb678f7660`.
- JPEG, `2,202,043` bytes, private and durable across reload/sign-out/sign-in.
- `capture_context.scene` uses normalized image coordinates.
- Existing calibrated support surfaces remain dresser top, bed, and floor.
- Existing fixed blockers include lamp/clothes/boxes/bag calibration and the `bed-foreground` occluder.

## Object Interaction v4 — protected interaction core
- Per-object transparent responders own one-finger object gestures immediately on pointer-down.
- Minimum screen-space interaction target remains 44 px after zoom scaling.
- Dragging uses original bounding box + normalized pointer delta; the object is never recentered under the finger.
- A tap selects without persistence; one durable scene write occurs on valid release.
- Invalid drops revert; unsupported drops continue through deterministic gravity.
- Empty-space pan, pinch, double-tap zoom, and explicit zoom controls remain viewport responsibilities.
- Native two-finger pinch can cancel/revert an active object move on iOS without persisting it.
- This core previously produced improved live finger/zoom/pan behavior and remains intentionally unchanged.

## Refinement pipeline — proven live
The latency-reduced v3 preparation path completed successfully on 2026-08-20:
- `/api/ai/photo-scene-assets/resolve` returned `200`.
- `/api/ai/photo-scene-assets` returned `200`.
- Supabase persisted both private derivatives:
  - `3a834786-c1b7-40bc-ab0f-70a7acbcc96b` — background plate / `localized_mask_inpaint_v3`.
  - `082cd10a-9a01-4c2c-a817-ce75a04fd3ac` — exact source cutout / `exact_source_mask_v3`.
- This proved source resolution, localized GPT Image background reconstruction, exact source-pixel alpha extraction, private Storage upload, metadata persistence, signed URL return, and in-place refined rendering can function end to end.

## Visual acceptance finding — old object identity was wrong
The latest user screenshot exposed a material calibration defect rather than a compositor failure:
- The refined object being moved was visibly the left-side dresser clutter/lamp region, not a plant.
- The persisted legacy movable item was labeled `plant`, but its `sourceBbox` is `x=0.10, y=0.455, w=0.205, h=0.15`.
- Mapping that box against the room photo places it over the same left dresser clutter visible in the moved cutout.
- Therefore the exact-pixel pipeline was faithfully extracting and moving the **wrong source region**.
- Further polishing of the legacy manual polygon would not solve the product problem. The durable defect was object identification/calibration.
- Legacy `manual_v3` movable identity is now treated as migration input rather than an authoritative arbitrary-room selection contract.

## New object-selection architecture
### User interaction
- Legacy/manual source scenes enter **Choose something to move** instead of silently treating the old hard-coded movable item as correct.
- The user taps near the center of one distinct object in the immutable Original image.
- The selection controller maps the tap to normalized source-photo coordinates.
- After a successful selection, **Choose another object** remains available so the room is not limited to a single predeclared item.

### Vision selection route
New authenticated route: `/api/ai/photo-object-select`.
- Owner/room/source asset are verified before reading private imagery.
- Server creates a resized private preview with a visible crosshair at the exact user tap.
- A vision-capable Vercel AI Gateway model identifies only the physical object under that crosshair.
- Expected output: short label, normalized full-image bbox, silhouette polygon(s) normalized to that bbox, and confidence.
- Server rejects malformed, low-confidence, overly large, or off-target selections rather than silently accepting them.
- The selected object receives a unique `picked-<uuid>` item id and `segmentation: vision_mask`.
- Overlapping fixed blocker calibration is removed when it substantially represents the same selected photographed item.
- Support is inferred from the selected object's bottom contact point against the existing support polygons; unresolved support remains nullable rather than fabricated.

### Vision-assisted exact-pixel derivatives
New authenticated route: `/api/ai/photo-scene-assets-v4`.
- Requires `scene.calibration: vision_assisted` and the exact selected item id.
- Exact movable appearance still comes from immutable source pixels via `sharp` + the vision-derived mask.
- Cutout render mode: `vision_source_mask_v4`.
- Background render mode: `localized_mask_inpaint_v4`.
- Background derivative reuse requires source asset + selected item id + render mode, eliminating the previous risk of reusing a background prepared for another object.
- Cutout derivative reuse is likewise selected-item scoped.
- Background generation remains localized GPT Image 2 medium-quality inpainting; only masked hidden pixels are composited back over the source photo.
- Pointer movement remains entirely browser-side after preparation.

## Public PhotoWorkspace orchestration
- `PhotoWorkspace.tsx` now owns migration from legacy/manual object identity to explicit user selection.
- While selecting, the immutable Original is shown directly and a tap is sent through the owner-scoped resolver and vision-selection route.
- The returned `PhotoScene` is persisted through the existing owner-scoped `onSceneChanged` path.
- Once the scene is `vision_assisted`, the controller automatically requests item-scoped v4 derivatives.
- Returned signed derivative URLs are applied **in place**; the Studio page is not reloaded.
- The public controller can recover by retrying refinement or selecting a different object without changing the accepted v4 interaction core.

## Current Preview — tap-selected object build
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_DFZ6jXdZkGtexwUY3d5qrja5zbpz`.
- URL: `https://nestmetric-lzoaappar-lew7.vercel.app`.
- State: `READY`.
- Preview only; no production alias changed.
- Deployment bootstrap pinned immutable application commit `aa004bc19e9e9c37be3826f9349bdd3c2b6a0d42`.
- Full validation passed:
  - Release structure PASS.
  - Strict TypeScript PASS.
  - Room Model schema/RLS gate PASS.
  - Domain/interaction tests `10/10` PASS.
  - Next.js `16.3.1` production build PASS.
- Built route inventory now includes both `/api/ai/photo-object-select` and `/api/ai/photo-scene-assets-v4` in addition to existing photo/auth/Room Model routes.
- Runtime error scan after deployment found no current object-selection/v4-refinement error cluster; the new routes have not yet received authenticated live acceptance traffic.
- `npm install` continues to report one high-severity dependency advisory. No forced dependency upgrade has been applied without audit.

## Remaining live acceptance gates
1. Open the new Preview on iPhone. The old manual scene should enter **Choose something to move** rather than rendering the misidentified “plant” as authoritative.
2. Tap a clearly distinct object in the room photo, preferably near its visual center.
3. Confirm the vision route identifies the intended item and the selected source box/mask no longer comes from the unrelated left dresser clutter.
4. Allow the first item-scoped v4 background/cutout preparation to finish.
5. Confirm the refined object visually corresponds to the object tapped and does not carry large unrelated background fragments.
6. Re-test finger drag, zoom/pan, dresser/bed support where appropriate, unsupported-drop gravity, and foreground occlusion.
7. Use **Choose another object** and verify a different selection creates a distinct item/derivative identity rather than reusing the first object's assets.
8. Do not promote to production until object identity, silhouette quality, and interaction behavior pass these checks.

## Production state
The existing NestMetric production alias remains on the previously verified older release. Current object-selection/refinement work is **not production-promoted**.

## Known platform constraints
- The long-lived Vercel project still reports `framework: null` and can inherit a stale `public` output-directory expectation. Preview deployments use a deployment-only Next.js configuration override.
- Inline Preview deployment does not reliably inherit every project runtime environment variable; AI uses Vercel AI Gateway/OIDC and the dedicated Supabase project configuration remains available for backend access.
- Supabase default SMTP is not production-ready; Google OAuth remains the accepted authentication path unless custom SMTP is added.

## Authoritative record status
- `CURRENT-STATE.md`: updated for the screenshot diagnosis, architecture decision, application commit, validation, deployment, and remaining live gates.
- `ARCHITECTURE.md`: updated because arbitrary-object identity and derivative scoping changed durably from hard-coded/manual object identity to user-tap + vision-assisted selection.
- `DESIGN-SYSTEM.md`: no durable design-system rule changed in this increment.
- `PROJECT-CONSTITUTION.md`: no governance/product-constitution rule changed in this increment.
