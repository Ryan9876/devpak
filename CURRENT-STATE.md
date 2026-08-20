# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Google OAuth live acceptance passed; durable starter Room Model confirmed; Geometry interaction live-accepted; private source-photo durability accepted; AI visual proposal generation/private persistence live-accepted; surface-aware direct photo manipulation v1 and refined v2 live-tested but visually insufficient; photo manipulation v3 exact-pixel compositor is source-complete and build-validated in a READY Preview, with live exact-cutout visual acceptance still pending; not production-promoted.**

### Canonical source
- Repository: `Ryan9876/devpak`.
- Canonical `main` remains unchanged by this work.
- Active feature branch: `parallax/photo-manipulation-v3`, created from the v2 branch.
- Runtime commit validated in the current v3 Preview: `0701b822f02446614a89f0362f6383eebe64e936`.
- Subsequent authoritative-record commits do not change the validated v3 runtime code.
- Temporary Vercel bootstrap files are deployment-only and are not canonical source artifacts.

### Durable product direction — 2026-08-20
- NestMetric is a **functional photo-augmentation product, not a CAD application**.
- The real room photo is the primary user-facing workspace for Organize, Arrange, and early Build exploration.
- The canonical Room Model remains authoritative for geometry, constraints, measurement evidence, persistence, and Build readiness, but is surfaced as a secondary Geometry view when precision matters.
- Direct photo manipulation uses a calibrated normalized image-space scene contract and does not pretend measured top-down coordinates are already projected into a perspective photograph.
- AI-generated visual proposals and background inpainting are advisory/rendering layers. They never mutate deterministic placement rules or measured Room Model truth.

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
- Accepted visual-proposal asset id: `1ae12441-c643-4e63-9a92-19117ed33c42`.

### Geometry interaction acceptance
- The user live-tested the refined Geometry drag interaction and reported: **“It works.”**
- Geometry retains exact grab-offset dragging, continuous motion, release-time 50 mm snap, boundary clamping, contextual conflicts, invalid-drop reversion, true physical aspect ratio, and one durable write per valid release.
- Geometry remains a secondary precision utility.

### Surface-aware direct photo manipulation
- The source photo has a durable `PhotoScene` calibration in `capture_context.scene` using normalized image coordinates.
- Calibrated support surfaces: dresser top, bed, and floor.
- Movable item: plant.
- Fixed collision footprints include the lamp, folded clothes, shoe boxes, and floor bag.
- Deterministic support/collision/gravity behavior is implemented and domain-tested: supported placement, same-surface blockers, nearest-clear placement, and unsupported release to the next lower valid support.
- The current source photo carries a `bed-foreground` occluder mask that hides floor-level objects behind the foreground bed region.
- The user live-tested v1 and reported **“It’s very crude but it’s a start.”** v2 improved compositing only slightly, so both crop-based and AI-recreated live-object rendering are superseded by v3.

### Photo manipulation v3 — exact source pixels
- Active branch: `parallax/photo-manipulation-v3`.
- The current source-photo scene was upgraded in place to scene version `2`, calibration `manual_v3`, while preserving the user’s last accepted plant position/support state on the bed.
- The plant now carries four calibrated `sourceMasks` normalized to its immutable `sourceBbox` plus segmentation provenance `manual_polygon_v3`.
- `/api/ai/photo-scene-assets` no longer asks an image model to recreate the live draggable plant.
- The route uses pinned `sharp@0.34.3` to crop the **actual source JPEG pixels** and apply the segmentation masks as an alpha channel, producing a private transparent PNG with `captureMethod: scene_object_cutout` and `renderMode: exact_source_mask_v3`.
- Exact object extraction is deterministic and cannot redesign the plant, alter leaf identity, substitute a similar plant, or change the source texture.
- A clean private background plate is still required to reveal the dresser/wall behind the source location. Existing plates are reused; if absent, GPT Image 2 performs only the narrow background inpainting operation.
- Live dragging remains browser-side compositing with the exact-pixel cutout, deterministic support/collision/gravity, perspective-aware scale, support-dependent contact shadow, and calibrated foreground occlusion.
- Rectangular selection chrome and corner handles were removed from the v3 normal photo state; selection uses a restrained silhouette-like glow.
- No image model is called per pointer move or per normal drag interaction.
- **Live v3 cutout generation and visual-quality acceptance are pending.** Build success proves the deterministic extraction path compiles; it does not yet prove the calibrated mask is visually accurate enough on the actual photo.

### Current v3 Preview — build validated
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_9kw9soBpdCs5VhzHZVdnGn3izULo`.
- URL: `https://nestmetric-ht2a1879l-lew7.vercel.app`.
- State: `READY`.
- Preview only; production aliases were not changed.
- Deployment bootstrapped immutable canonical GitHub runtime commit `0701b822f02446614a89f0362f6383eebe64e936`.
- Canonical dependency installation succeeded under Node 24, including `sharp@0.34.3`.
- Domain validation passed `6/6`: existing Room Model tests plus photo support, collision, and gravity tests.
- Next.js `16.3.1` production compilation passed.
- TypeScript passed.
- Built routes include `/api/ai/photo-scene-assets`, `/api/ai/photo-proposal`, `/api/ai/plan`, `/api/health/backend`, `/auth/google`, `/auth/callback`, `/auth/signout`, `/login`, and `/studio`.
- Automated authenticated route execution remains limited by Vercel Preview Protection; live browser acceptance is still required for the v3 exact cutout.

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
