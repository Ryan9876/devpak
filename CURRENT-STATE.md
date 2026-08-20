# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Core photo-first functionality now has live evidence across Google OAuth, durable Room Model storage, private source-photo persistence, visual proposals, Geometry interaction, v4 mobile drag/zoom/pan, deterministic support/collision/gravity, user-tap object identification, and item-scoped v4 derivative generation. The latest live iPhone test correctly identified a plastic water bottle and successfully generated its private background/cutout derivatives. The screenshot also exposed a UX defect: while those derivatives were still being prepared, NestMetric exposed the crude legacy fallback/source-hole renderer. That intermediate renderer is now suppressed in a new READY Preview; the original photo remains visually intact and movement stays locked until the refined object layer is ready. Production remains unchanged.**

## Canonical source
- Repository: `Ryan9876/devpak`.
- Active branch: `parallax/object-interaction-v4`.
- Canonical `main` remains unchanged.
- Current application source validated in Preview: `9081bcb78063a090d2b6ffa5220e18f19784e3be`.
- Object-selection Gateway identity repair: `2a25b9bacae90b610f7e144a2112805141d81eb6`.
- Persistent picker error UX: `6bc96e85b93aba78f5d375faf39aaf6f4fe53395`.
- Clean preparation-shell UX: `9081bcb78063a090d2b6ffa5220e18f19784e3be`.
- `src/components/PhotoWorkspaceCore.tsx` remains the accepted v4 drag/zoom/pan/physics implementation and was not modified by the preparation-shell increment.
- Deployment-only bootstrap/config files are not canonical application source artifacts.

## Product and architecture baseline
- NestMetric is a functional photo-augmentation product, not a CAD application.
- The immutable real room photo is the primary workspace; the Room Model remains authoritative for geometry, measurements, constraints, verification, and Build readiness.
- Object identity is user-directed: the user taps a photographed object and vision determines the specific object boundary around that point.
- AI may identify the user-selected object and reconstruct pixels hidden behind it, but the movable object itself continues to use exact source-photo pixels and deterministic support/collision/gravity remains authoritative.
- Selected-object derivatives are scoped by source asset + unique selected item id so assets from one object cannot be silently reused for another.

## Accepted backend/auth baseline
- Supabase project: `NestMetric` (`yyrpennpmwajlbepoemt`), region `us-east-1`.
- Eight owner-scoped public tables have RLS enabled.
- Private Storage bucket `room-assets` is the durable store for source photos and derivatives.
- Google OAuth live browser acceptance passed through `/auth/google` → Supabase Google OAuth/PKCE → `/auth/callback` → authenticated `/studio`.
- Starter Room Model persistence was confirmed live.

## Accepted source-photo and interaction baseline
- Source asset: `59cab87c-055a-420b-9b7f-97bb678f7660`, private JPEG, `2,202,043` bytes.
- Existing support calibration includes dresser top, bed, and floor; fixed blockers and the bed foreground occluder remain in the source scene.
- Object Interaction v4 uses per-object transparent responders, minimum 44 px screen-space hit targets, original-box + normalized pointer-delta dragging, one durable scene write per valid release, invalid-drop reversion, and deterministic gravity for unsupported drops.
- Empty-space pan, pinch, double-tap zoom, and explicit zoom controls remain viewport responsibilities.
- This interaction core previously produced materially improved live iPhone finger/zoom/pan behavior and is protected from regression.

## Refinement pipeline — proven live
The exact-pixel preparation path has now completed successfully for both the earlier legacy calibration and a user-selected object:
- Owner-scoped source resolution works.
- Localized GPT Image background reconstruction works.
- Exact source-pixel alpha extraction works.
- Private Storage and metadata persistence work.
- Signed derivative URLs return successfully to the browser.
- Item-scoped v4 reuse prevents derivatives from one selected object being silently reused for another.

## Vision-assisted object selection
### Selection contract
- Legacy/manual scenes enter **Choose something to move** rather than treating the old movable label as authoritative.
- The user taps near the center of one distinct object in the immutable Original.
- `/api/ai/photo-object-select` validates the authenticated owner/room/source photo, creates a marked private preview, and asks a vision-capable model to identify only the physical object under the tap.
- The server expects a label, normalized full-image bounding box, silhouette polygon(s) normalized to that box, and confidence.
- Malformed, low-confidence, overly large, or off-target selections are rejected rather than persisted.
- Successful selections receive a unique `picked-<uuid>` id and `segmentation: vision_mask`, then persist through the existing owner-scoped scene write path.

### Item-scoped refinement
- `/api/ai/photo-scene-assets-v4` requires `scene.calibration: vision_assisted` and the exact selected item id.
- Cutout render mode: `vision_source_mask_v4`.
- Background render mode: `localized_mask_inpaint_v4`.
- Background and cutout reuse are selected-item scoped.
- Exact object appearance comes from immutable source pixels; GPT Image is used only for localized hidden-background reconstruction.

## Live tap-selection repair — accepted
The first tap-selection Preview failed because `/api/ai/photo-object-select` incorrectly required an explicitly visible Gateway/OIDC environment variable. That produced four consecutive 503 responses.

The repair moved object identification to AI SDK 7 multimodal `generateText`, delegating deployment authentication to Vercel's working AI Gateway identity path. The picker also retains and displays failures rather than silently clearing the tap marker.

Live iPhone testing of the repaired Preview then succeeded:
- `POST /api/ai/photo-object-select` returned `200`.
- The selected object was correctly labeled **plastic water bottle**.
- Persisted selected item: `picked-6596b364-0470-4d1d-977a-23920e6012c0`.
- Persisted source box was tight and object-scale: `x=0.0895, y=0.5186, w=0.0343, h=0.0614`.
- The stored vision polygon is bottle-shaped rather than a large surrounding room region.
- The screenshot's `Supported by bed` state was consistent with the bottle's moved position at that moment; it is not evidence of a support-classification defect.

## Live v4 derivative success for selected bottle
The selected bottle completed the item-scoped v4 preparation flow:
- `/api/ai/photo-scene-assets/resolve` returned `200`.
- `/api/ai/photo-scene-assets-v4` returned `200`.
- Private background derivative: `03f21b22-8f92-4b5a-8d5b-10c45eab9a55` — `localized_mask_inpaint_v4`.
- Private bottle cutout: `99d25a9d-aaac-4442-bc6d-7197d1e4d4f6` — `vision_source_mask_v4`, `38,568` bytes.
- Both derivatives are scoped to `picked-6596b364-0470-4d1d-977a-23920e6012c0`.
- This is the first live evidence that tap-selected arbitrary object identity and item-scoped exact-pixel refinement work together end to end.

## Latest UX finding — crude preparation fallback
The user screenshot taken while the bottle derivatives were still being prepared showed a beige/crude temporary object/hole representation. That was not the final bottle cutout; it came from the legacy fallback renderer being exposed during first-run preparation.

This was misleading for a commercial-quality workflow because the product appeared visually broken even though the correct bottle derivative was still being generated successfully.

### Preparation-shell repair
`PhotoWorkspace.tsx` now suppresses the crude interaction core while a newly selected object is awaiting refined derivatives:
- The immutable Original photo remains visually intact.
- A restrained outline marks the selected source object.
- A clear preparation status explains that NestMetric is isolating the real object and cleaning pixels behind it.
- Object movement remains locked until the clean background and exact object cutout are available.
- The refined v4 interaction core appears automatically once returned signed derivative URLs are ready.
- If preparation genuinely fails, the explicit Basic manipulation fallback and Retry path remain available.
- The preparation effect now aborts its browser request on controller cleanup rather than leaving stale client work active after the component changes.
- No support, collision, gravity, viewport, or object-drag algorithms changed.

## Current Preview — clean preparation shell
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_Hpda2jzBcUoQTADssXRqSrFj5fZ2`.
- URL: `https://nestmetric-l7aebbf9x-lew7.vercel.app`.
- State: `READY`.
- Preview only; no production alias changed.
- Deployment bootstrap pinned immutable application commit `9081bcb78063a090d2b6ffa5220e18f19784e3be` and verified the new preparation-shell source markers before validation.
- Full validation passed:
  - Release structure PASS.
  - Strict TypeScript PASS.
  - Room Model schema/RLS gate PASS.
  - Domain/interaction tests `10/10` PASS.
  - Next.js `16.3.1` production build PASS.
- Built routes include `/api/ai/photo-object-select`, `/api/ai/photo-scene-assets-v4`, the existing photo proposal/planning routes, backend health, auth routes, and `/studio`.

## Remaining live acceptance gates
1. Open the clean preparation-shell Preview on iPhone.
2. Use **Choose another object** and tap a distinct object not already prepared, so the first-run preparation UI is exercised.
3. Confirm the original photo remains intact during preparation and no beige/crude temporary cutout is shown.
4. Confirm movement unlocks only after refined derivatives are available.
5. Evaluate the final selected-object silhouette and reconstructed background quality after readiness.
6. Re-test finger drag, zoom/pan, relevant support surfaces, unsupported-drop gravity, and foreground occlusion.
7. Select at least one additional object to verify distinct object identity and derivative scoping.
8. Do not promote to production until refined visual quality and these interaction gates pass.

## Production state
The existing NestMetric production alias remains on the previously verified older release. Current object-selection/refinement work is not production-promoted.

## Known platform/maintenance constraints
- The long-lived Vercel project still reports `framework: null` and can inherit a stale `public` output-directory expectation. Preview deployments use a deployment-only Next.js configuration override.
- Inline Preview deployment does not reliably inherit every project runtime environment variable; AI code should use Vercel AI SDK/Gateway deployment identity rather than assuming `VERCEL_OIDC_TOKEN` is directly readable.
- The successful object-selection request emitted an AI SDK deprecation warning for the older `image` message-part form. Current Vercel documentation recommends a `file` content part with an image media type. This is non-blocking but should be cleaned up in a subsequent maintenance change.
- Canonical dependency installation continues to report one high-severity dependency advisory. No forced dependency upgrade has been applied without audit.
- Supabase default SMTP is not production-ready; Google OAuth remains the accepted authentication path unless custom SMTP is added.

## Authoritative record status
- `CURRENT-STATE.md`: updated for successful live bottle identification, successful selected-item v4 derivatives, the screenshot diagnosis, preparation-shell source commit, validation, and READY Preview.
- `ARCHITECTURE.md`: no update required; withholding crude manipulation during preparation aligns the already-recorded refinement orchestration boundary rather than changing durable architecture.
- `DESIGN-SYSTEM.md`: no durable design-system rule changed.
- `PROJECT-CONSTITUTION.md`: no governance/product-constitution rule changed.
