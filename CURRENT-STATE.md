# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; Geometry interaction live-accepted; private source-photo durability accepted; AI visual proposal generation/private persistence live-accepted; surface-aware direct photo manipulation v1/v2 were visually insufficient; v3 exact-pixel interaction is build-validated with corrected mobile gestures and localized masked background preparation, but live exact-cutout/background quality acceptance is still pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`.
- Canonical `main` remains unchanged by this work.
- Active feature branch: `parallax/photo-manipulation-v3`.
- Corrected v3 runtime commit validated in the current Preview: `75f17e6fe9aca677ce3b3c7cc32ff2a826d481bf`.
- Subsequent commits on the same branch update authoritative records only and do not change that validated runtime package.
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
- The current source-photo scene is version `2`, calibration `manual_v3`, while preserving the user’s last accepted plant support state.
- The plant carries four calibrated `sourceMasks` normalized to its immutable `sourceBbox` plus segmentation provenance `manual_polygon_v3`.
- `/api/ai/photo-scene-assets` uses pinned `sharp@0.34.3` to auto-orient the source photo, crop the **actual source pixels**, and apply the calibrated alpha masks, producing a private transparent PNG with `captureMethod: scene_object_cutout` and `renderMode: exact_source_mask_v3`.
- The live draggable plant is therefore not recreated by an image model.
- Background preparation was corrected after the latest live-test screenshot: whole-frame AI background generation is no longer valid for v3. The route now performs **localized masked inpainting** on a padded crop around the plant and composites only the expanded/feathered plant-mask region back over the source photograph.
- Valid v3 backgrounds use `captureMethod: scene_background_plate` and `renderMode: localized_mask_inpaint_v3`; older whole-frame background plates are ignored for v3 reuse.
- The background asset records `sourceInvariant: outside_object_mask` to document that unrelated scene content must remain sourced from the original photograph.
- Live dragging remains browser-side compositing with exact source pixels, deterministic support/collision/gravity, perspective-aware scale, contact shadow, and calibrated foreground occlusion.
- iOS/Safari native image callouts/context menus are suppressed on the manipulation surface so a long press does not steal the drag gesture.
- Rectangular selection chrome and corner handles remain excluded from the normal v3 photo state.

### Latest live-test diagnosis — 2026-08-20
- The user reported **“Not quite working”** and supplied an iPhone screenshot showing Safari's native image context menu.
- Supabase inspection at that moment showed only source-photo and AI-proposal assets for the room; **no `scene_background_plate` or `scene_object_cutout` derivative had been created yet**.
- The screenshot was therefore of an AI **Visual Proposal**, not a prepared/calibrated Original manipulation surface. The proposal was being long-pressed as a normal image, which invoked Safari's native menu.
- This exposed a UX failure even though the v3 preparation route had not yet been exercised: Visual Proposals must clearly say **view only**, and the interface must direct users to `Original` for manipulation instead of relying on internal product knowledge.
- The corrected runtime adds a `view only` proposal badge/message and disables native image callouts on the photo surface.
- **Live v3 derivative preparation and edge/background quality remain pending.** The next valid acceptance test must use `Original`, run the refinement preparation, then drag the exact-pixel plant.

### Current corrected v3 Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_rA3S7bs1mU1YWbEGYni4X6Hou8AQ`.
- URL: `https://nestmetric-n0ccyeya6-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrapped immutable runtime commit `75f17e6fe9aca677ce3b3c7cc32ff2a826d481bf`.
- Bootstrap verification explicitly checked for `localized_mask_inpaint_v3`, `sourceInvariant: 'outside_object_mask'`, proposal `view only` UI, and `onContextMenu` suppression before validation.
- Domain validation passed `6/6`, including photo support, collision, and gravity tests.
- Next.js `16.3.1` production compilation passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.

### Production state
The existing NestMetric production alias remains on the previously verified older release. v0.2.2/photo-first/direct-manipulation work is **not production-promoted**. Production promotion remains gated on live v3 manipulation acceptance and explicit promotion authorization.

### Known platform constraints
- Vercel project-level framework configuration still reports `framework: null`; Preview deployments explicitly supply a Next.js framework override.
- The Vercel inline deployment path does not reliably inherit project runtime environment variables. Public Supabase project configuration has a safe dedicated-project fallback; AI generation uses Vercel AI Gateway/OIDC rather than an inherited OpenAI provider key.
- Supabase default SMTP is not production-ready; Google OAuth is the accepted auth path unless custom SMTP is added later.

## Development workflow normalization
- GitHub `main` remains the canonical source of truth.
- Changes use `parallax/...` branches.
- Release flow remains: source change → scoped validation → Preview → live acceptance → merge/promotion.
- Preview validation may use a deployment-only bootstrap pinned to an immutable canonical GitHub commit so the build tests exact source without hand-copying the runtime tree.
