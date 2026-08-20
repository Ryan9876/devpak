# NestMetric Current State

## v0.2.2 Phase 2 photo-first durable-backend release candidate
Status: **Core photo-first functionality has live evidence: Google OAuth, durable Room Model storage, private source-photo persistence, visual proposals, Geometry interaction, v4 mobile drag/zoom/pan, deterministic support/collision/gravity, and first-run refined derivative generation. The hard-coded legacy movable-object calibration was superseded by user-tap + vision-assisted object selection after visual acceptance proved the old “plant” pointed at unrelated dresser clutter. The first tap-selection Preview then exposed a deployment-identity defect: every live object-selection request returned 503 because the route incorrectly required an explicitly visible AI Gateway/OIDC environment variable. That defect is repaired in a new READY Preview using the Vercel AI SDK multimodal path; live tap acceptance remains pending. Production remains unchanged.**

## Canonical source
- Repository: `Ryan9876/devpak`.
- Active branch: `parallax/object-interaction-v4`.
- Canonical `main` remains unchanged.
- Current application source validated in Preview: `6bc96e85b93aba78f5d375faf39aaf6f4fe53395`.
- Object-selection Gateway identity repair: `2a25b9bacae90b610f7e144a2112805141d81eb6`.
- Persistent picker error UX: `6bc96e85b93aba78f5d375faf39aaf6f4fe53395`.
- `src/components/PhotoWorkspaceCore.tsx` remains the accepted v4 drag/zoom/pan/physics implementation and was not modified by this repair.
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
The earlier latency-reduced exact-pixel preparation path completed successfully on 2026-08-20:
- `/api/ai/photo-scene-assets/resolve` returned `200`.
- `/api/ai/photo-scene-assets` returned `200`.
- Supabase persisted a private localized background plate and exact source-pixel cutout.
- This proved owner-scoped source resolution, localized GPT Image reconstruction, exact alpha extraction, Storage persistence, metadata persistence, signed URL return, and refined browser compositing can work end to end.
- Visual acceptance then showed that the legacy source box represented the wrong physical object. The derivative machinery worked; object identity/calibration was wrong.

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

## Live tap-selection failure — diagnosed
Live iPhone testing of Preview `dpl_DFZ6jXdZkGtexwUY3d5qrja5zbpz` produced the reported behavior: the tap marker and **Identifying object…** state appeared briefly, then disappeared with no selected object.

Runtime evidence:
- Four consecutive authenticated `POST /api/ai/photo-object-select` calls returned `503` at 15:57–15:58 UTC on 2026-08-20.
- The route returned 503 before invoking the model because it required `AI_GATEWAY_API_KEY || VERCEL_OIDC_TOKEN` to exist as an explicitly visible runtime environment variable.
- Inline Preview deployments do not reliably expose that token variable, even though Vercel deployment identity works through the AI SDK. The already-working image-generation path was evidence that AI Gateway itself was available.
- This was a deployment/auth integration defect, not a failed user tap, slow model, or bad object boundary.

## Repair — AI SDK multimodal identity path
`/api/ai/photo-object-select` now uses `generateText` from AI SDK 7 with a multimodal user message containing the selection prompt plus the marked JPEG.
- Model remains configurable via `NESTMETRIC_OBJECT_SELECTOR_MODEL`, defaulting to `openai/gpt-5.6-sol`.
- The route no longer performs an invalid preflight check for an explicitly visible Gateway/OIDC token.
- Gateway/deployment authentication is delegated to the same AI SDK identity mechanism used successfully elsewhere in NestMetric.
- `maxRetries: 0` and a 45-second abort ceiling remain explicit.
- Existing bbox/polygon/confidence validation and scene construction remain unchanged.

## Picker failure UX repair
`PhotoWorkspace.tsx` now keeps failures visible:
- The user’s tap marker remains visible after a failed identification and changes to an error treatment.
- The instruction panel becomes an inline alert with the actual returned error instead of silently reverting to the generic picker state.
- A subsequent tap clears the old error and starts a new identification attempt.
- Successful selection still clears the marker/error and proceeds to item-scoped refinement.

## Current Preview — object-selection repair
- Vercel project: `nestmetric` (`prj_oHT2phzLSIar0gozplD2yQGV6Wrk`).
- Deployment: `dpl_AM5Jo1XM9ZMpqBsZz8wz4WRRY1V8`.
- URL: `https://nestmetric-8ng1c382c-lew7.vercel.app`.
- State: `READY`.
- Preview only; no production alias changed.
- Deployment bootstrap pinned immutable application commit `6bc96e85b93aba78f5d375faf39aaf6f4fe53395`.
- Full validation passed:
  - Release structure PASS.
  - Strict TypeScript PASS, including the AI SDK multimodal image-input request shape.
  - Room Model schema/RLS gate PASS.
  - Domain/interaction tests `10/10` PASS.
  - Next.js `16.3.1` production build PASS.
- Built routes include `/api/ai/photo-object-select` and `/api/ai/photo-scene-assets-v4` plus the existing photo/auth/Room Model routes.
- `npm install` continues to report one high-severity dependency advisory. No forced dependency upgrade has been applied without audit.

## Remaining live acceptance gates
1. Open the current repair Preview on iPhone and tap one clearly distinct object near its visual center.
2. Confirm `/api/ai/photo-object-select` no longer returns 503 and that a usable selected item is returned.
3. If the model rejects the boundary, confirm the actual error remains visible in the picker rather than disappearing.
4. Confirm the selected object visually corresponds to the object tapped.
5. Allow item-scoped v4 background/cutout preparation to complete and confirm the refined object does not carry unrelated background fragments.
6. Re-test finger drag, zoom/pan, relevant support surfaces, unsupported-drop gravity, and foreground occlusion.
7. Use **Choose another object** to verify distinct object identity and derivative scoping.
8. Do not promote to production until these checks pass.

## Production state
The existing NestMetric production alias remains on the previously verified older release. Current object-selection/refinement work is not production-promoted.

## Known platform constraints
- The long-lived Vercel project still reports `framework: null` and can inherit a stale `public` output-directory expectation. Preview deployments use a deployment-only Next.js configuration override.
- Inline Preview deployment does not reliably inherit every project runtime environment variable; AI code should use Vercel AI SDK/Gateway deployment identity rather than assuming `VERCEL_OIDC_TOKEN` is directly readable.
- Supabase default SMTP is not production-ready; Google OAuth remains the accepted authentication path unless custom SMTP is added.

## Authoritative record status
- `CURRENT-STATE.md`: updated for the live 503 evidence, root cause, source repair, validation, new Preview, and remaining acceptance gate.
- `ARCHITECTURE.md`: no durable architecture change required for this repair; it corrects the implementation of the already-recorded vision-assisted selection contract.
- `DESIGN-SYSTEM.md`: no durable design-system rule changed.
- `PROJECT-CONSTITUTION.md`: no governance/product-constitution rule changed.
