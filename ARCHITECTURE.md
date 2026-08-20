# NestMetric Architecture

## Phase 2 target architecture
NestMetric is a functional photo-augmentation application backed by one canonical Room Model. The photographed room is the primary user-facing workspace for Organize, Arrange, and early Build exploration; measured geometry remains the authoritative spatial layer underneath it.

### Runtime
- Next.js App Router on Vercel.
- Supabase project `yyrpennpmwajlbepoemt` provides managed PostgreSQL, Auth, and private object Storage for the durable production backend.
- Supabase SSR cookie clients are request-scoped; server authorization uses verified claims rather than trusting client session payloads.
- Supabase runtime configuration is centralized. Environment variables remain the preferred override, while the dedicated project's public URL and publishable key are safe source defaults so inline preview deployments cannot lose connectivity when Vercel omits project runtime variables. Secret/service-role credentials are never source defaults.

### Authentication
- Google OAuth is initiated through the server route `/auth/google`, not directly from browser-side Supabase JavaScript.
- The server-side Supabase SSR client creates the PKCE authorization flow and redirects the browser to Google through Supabase Auth.
- Google returns to Supabase Auth, which redirects to NestMetric `/auth/callback`; that route exchanges the authorization code for the cookie-backed session before entering `/studio`.
- Email magic-link authentication uses the same `/auth/callback` session boundary and remains a fallback path.
- OAuth provider secrets live in Supabase provider configuration. Browser/runtime code receives only the Supabase project URL and publishable key.

### Photo augmentation layer
- Original room photos are private objects in the existing `room-assets` bucket and owner-scoped `room_assets` rows.
- AI visual proposals are separate private assets, never replacements for source photos. Their `capture_context.captureMethod` is `ai_photo_proposal` and records the source asset, mode, goal, model, gateway, and generation time.
- The server downloads the authenticated owner's private source photo and passes image bytes as reference input to Vercel AI Gateway image generation for whole-photo visual proposals and narrowly scoped background inpainting.
- Vercel-hosted AI Gateway requests use deployment identity/OIDC rather than an OpenAI API key embedded in application configuration. Provider credentials are not committed to source or exposed to the browser.
- Visual proposals do not mutate Room Model coordinates, measurements, constraints, or build-readiness evidence. The original image remains available as the stable comparison reference.
- A top-down Room Model is not assumed to be calibrated to a perspective photograph. Photo-space manipulation therefore uses an explicit image-space scene contract rather than pretending Room Model coordinates map directly into the photograph.

### Photo scene interaction layer
- Direct photo manipulation uses a source-photo-owned `PhotoScene` stored in that source asset's `capture_context.scene`. It is versioned independently from the measured Room Model and uses normalized image coordinates (`0..1`) so interactions remain stable across responsive rendering sizes.
- A `PhotoScene` contains support-surface polygons, visual items, item support relationships, support-plane footprints, optional foreground occluders, source-pixel segmentation masks, and calibration provenance.
- Movable objects use a bottom-center support point and a support-plane footprint. Collision is evaluated between footprints on the same support surface, so soft visual extents do not behave like rigid collision boxes.
- Functional gravity is deterministic support resolution, not a general rigid-body physics engine. If a released item has no valid support at its current location, a vertical image-space ray resolves the next lower compatible surface; the item settles there at a perspective-adjusted visual scale or rejects when no valid landing exists.
- Support surfaces have an explicit visual-depth order. Current examples include dresser top, bed, and floor, so an object can settle onto a bed before the floor when that is the nearest visible lower support.
- Blocked placement may snap to the nearest clear position on the same surface; otherwise it reverts. Surface, blocker, and gravity feedback is contextual during the active drag and is not shown as persistent CAD-style markup.
- Scene position changes persist only to the source photo's scene metadata and do not mutate Room Model measurements, object coordinates, constraints, or Build readiness.
- Generated visual proposals are view-only for direct manipulation. Manipulation is anchored to the original calibrated source photo; proposals may be used for visual comparison but are not assumed to be pixel-identical scene geometry.

### User-directed object identification
- A hard-coded semantic object such as a predeclared “plant” is not a valid durable interaction contract for arbitrary room photos.
- Object identity begins with an explicit user tap on the immutable Original photo. The tap coordinates are normalized to the displayed source image and remain the authoritative indication of which object the user intends to manipulate.
- `/api/ai/photo-object-select` is authenticated and owner-scoped. It reads only the selected owner/room/source asset, creates a marked preview with the user's tap location, and uses a vision-capable Vercel AI Gateway model to identify the single physical object under that point.
- The vision model returns a short label, a normalized source bounding box, one or more silhouette polygons normalized to that box, and confidence. Server validation rejects low-confidence, oversized, malformed, or off-target selections rather than silently accepting a broad region.
- Vision output defines **selection geometry only**. It does not generate or replace the live object pixels. Live manipulation continues to use pixels from the immutable source photograph.
- Each successful selection receives a unique movable item id and `segmentation: vision_mask`. This prevents a changed selection from reusing stale cutout/background derivatives created for a different object.
- When the selected object's source box substantially overlaps a pre-calibrated fixed blocker, that blocker is removed from the photo scene so the same photographed item is not simultaneously treated as both movable and fixed.
- Support assignment is derived from the selected object's bottom-center contact point against the existing calibrated support polygons. If no support is confidently resolved, the object may remain unsupported until the deterministic placement/gravity system resolves a later drop.
- Legacy/manual movable-object calibration is treated as migration input, not as authoritative object identity. The public workspace prompts for an explicit object tap before using that legacy movable item as the production interaction target.

### Photo viewport interaction layer
- Zoom and pan are a view transform above the normalized photo-scene model. They never rewrite support surfaces, object coordinates, collision footprints, occluders, or persisted scene positions.
- The viewport contract is `{scale, tx, ty}` with a supported scale range of `1x..5x`. Translation is clamped so the transformed photograph continues to cover the visible canvas; returning to `1x` recenters the view.
- Pointer coordinates are converted through the inverse viewport transform before they enter object drag, support, collision, or gravity logic. This keeps manipulation physically consistent regardless of zoom or pan.
- Gesture ownership is deterministic: two active pointers always own pinch zoom/pan; one pointer beginning on a movable object owns object manipulation; one pointer on empty photo space pans only when zoomed; double-tap on empty photo space toggles between `1x` and `2.5x`.
- If a second pointer appears during object manipulation, the object move is cancelled/reverted and the two-finger viewport gesture takes precedence. A simple object tap does not create a persistence write.
- Zoom is anchored around the live pinch midpoint or double-tap point so the content under the user's fingers remains spatially stable while scaling.
- Small photographed objects may expose a minimum 44px invisible interaction target without changing their visible segmentation silhouette, scene footprint, collision geometry, or rendered size.
- Native image callouts and browser gesture ownership remain suppressed on the manipulation canvas so iOS/Safari does not steal pinch, pan, or drag interactions.

### Object interaction responder layer
- Object rendering and object hit-testing are separate layers. The visible cutout/crop is non-interactive; each movable object owns a dedicated transparent responder positioned over its photo-space footprint.
- A movable object's responder claims a one-finger pointer immediately on pointer-down and selects the object at gesture start. The canvas does not search DOM ancestry or heuristically decide which object the user intended to touch.
- The responder maintains at least a 44px screen-space hit target while remaining centered on the object's visible photo footprint. The minimum target is adjusted inversely with viewport zoom so a 44px target does not grow into an oversized screen-space region at high zoom.
- Object motion is start-state based: the responder records the object's original bounding box and normalized starting pointer once, then applies normalized pointer delta to that original box. The object is never recentered beneath the pointer and incremental frame drift is avoided.
- During the gesture only lightweight local scene state changes. Deterministic support/collision feedback can run continuously, but the durable source-photo scene is committed at most once on release.
- If release is invalid, the object reverts to the recorded original state. If unsupported, the existing deterministic gravity resolver chooses the nearest lower valid support. The responder layer does not replace or weaken NestMetric's support/collision/gravity rules.
- The photo canvas owns only viewport concerns: two-finger pinch, empty-space pan, double-tap zoom, and explicit zoom controls. Object selection and one-finger object movement are not canvas responsibilities.
- Native two-finger touch still has precedence over an active object responder on iOS. Starting a pinch cancels/reverts the in-progress object move and transfers ownership to the viewport without persisting the cancelled object state.

### Segmentation-first exact-pixel compositing
- The live draggable object is derived from the immutable source photo's actual pixels. AI does not recreate the object for live manipulation.
- Each movable item contains one or more `sourceMasks`, normalized to its `sourceBbox`. Multiple masks are composited as a union so separated visible regions can preserve exact photographed pixels while excluding unrelated room pixels.
- Legacy v3 manual masks use `renderMode: exact_source_mask_v3`. Vision-assisted selections use the item-scoped v4 path with `renderMode: vision_source_mask_v4`.
- `/api/ai/photo-scene-assets-v4` uses server-side `sharp` to auto-orient the original source photo, crop the exact selected source-pixel region, and apply the vision-derived alpha polygons. The resulting transparent PNG is stored privately with `captureMethod: scene_object_cutout`, the selected `itemId`, and v4 render mode.
- Exact-pixel cutout generation is deterministic and local to the application runtime after mask geometry is known. It does not call an image generator and therefore does not redesign, substitute, or restyle the selected item.
- The clean background plate uses **localized masked inpainting**, not whole-frame regeneration. The server extracts a padded crop around the selected source object, asks GPT Image 2 to reconstruct only the hidden local surface, resizes that result back to the crop dimensions, applies an expanded/feathered version of the selected object mask, and composites only those masked pixels over the auto-oriented source image.
- Pixels outside the selected object-mask region remain sourced from the original photograph. This prevents whole-room semantic drift such as added baskets, moved furniture, restyled surfaces, or changed lighting outside the selected object's original location.
- Vision-assisted background derivatives use `captureMethod: scene_background_plate`, `renderMode: localized_mask_inpaint_v4`, and the selected `itemId`. Reuse requires source asset + item id + render mode to match, preventing a background prepared for one object from being reused for another.
- Scene preparation is authenticated, owner-scoped, and idempotent for the selected item. Existing matching v4 derivatives are reused rather than regenerated on page load or pointer movement.
- Dragging after preparation is browser-side compositing: localized background plate + exact-pixel transparent object + deterministic contact shadow + foreground occlusion masks. No image generation occurs per pointer movement.
- Contact shadows are visual grounding derived from the item's support footprint and support kind; they do not alter placement validity.
- Foreground occluders are normalized image-space masks that redraw portions of the background plate above an object when that object is on a surface visually behind the occluder.
- Selection chrome is silhouette-oriented and intentionally restrained. Rectangular handles/selection boxes are excluded from the normal photo interaction state.
- Native browser image callouts/context menus are suppressed in the manipulation surface so touch-and-drag remains application interaction rather than invoking OS image actions.

### Object selection and automatic refinement orchestration
- The validated v4 drag/zoom/pan/physics engine remains isolated in `PhotoWorkspaceCore.tsx`. Object selection and derivative preparation are layered around it in the public `PhotoWorkspace.tsx` controller; the accepted core does not need to know how object identity or derivatives were produced.
- For legacy/manual calibration, the controller enters **Choose something to move** mode instead of silently presenting a hard-coded movable object as authoritative.
- Selection mode shows the immutable Original image and converts the user's tap to normalized source-photo coordinates. The controller resolves the owner-scoped source asset through `/api/ai/photo-scene-assets/resolve`, then requests vision selection through `/api/ai/photo-object-select`.
- The returned vision-assisted scene is persisted through the same owner-scoped source-photo scene write path used by normal manipulation.
- Once a vision-assisted item exists, the controller calls `/api/ai/photo-scene-assets-v4`. Existing item-scoped v4 derivatives are reused; otherwise the selected object's exact source cutout and localized background are created once.
- Preparation is non-blocking relative to the application shell. The current manipulation/fallback state remains visible with explicit preparation status rather than forcing a page reload.
- When v4 derivative URLs return, the controller swaps them into the existing workspace **in place**. Studio, selection state, and the broader application session are not reloaded merely to obtain fresh signed URLs.
- If preparation fails, the controller exposes an explicit recoverable state and retry path. The user can also choose a different object rather than being trapped by a bad semantic calibration.
- **Choose another object** is a persistent interaction affordance after a successful vision selection so arbitrary-object manipulation is not limited to the first item selected in a room.

### Canonical Room Model
- Integer micrometre coordinate system prevents floating-point drift in physical dimensions.
- Room bounds, openings, fixed objects, movable objects, assets, and measurement evidence share one coordinate contract.
- Measurement evidence records source, confidence, tolerance, device/calibration context, verification, and correction history.
- LiDAR/RoomPlan is an optional evidence source into this same model, never a separate product path.
- Geometry is surfaced to users as a secondary precision view rather than the default application metaphor.

### Safety / feasibility boundary
- Deterministic geometry validation is authoritative for bounds, clearances, openings, fixed-obstacle collisions, and snapping.
- Deterministic photo-scene support/collision/gravity rules are authoritative for direct photo manipulation; AI imagery does not override them.
- AI may identify the object under an explicit user tap and propose its source bounding box/silhouette mask. That AI result is validated and used only to determine which immutable source pixels belong to the selected object.
- AI may generate localized hidden-surface reconstruction and whole-photo visual proposals, but it does not decide whether a photo-space placement is supported or collision-free and does not generate the live draggable object's appearance.
- Photorealistic appearance is not evidence of dimensional accuracy.
- Build plans remain gated until required dimensional evidence is verified or explicitly corrected by the user.

### Persistence / ownership
- Owner-scoped relational rows are protected with RLS.
- Room source photos, visual proposals, background plates, and exact-pixel object cutouts use the private `room-assets` Storage bucket whose object path is rooted by authenticated user id.
- Source-photo scene metadata is persisted in the owner-scoped source asset row under `capture_context.scene`; derivative rendering assets reference that source asset rather than replacing it.
- Vision-assisted derivative identity includes the selected item id and render mode. Selecting a different object creates a new movable item identity, so stale derivatives from another object cannot satisfy the new selection's preparation contract.
- Production application data must use Supabase PostgreSQL and private Storage; Vercel local filesystem storage is not an authoritative persistence layer.

### Migration
The existing SQLite/filesystem implementation is treated as a legacy source. Cutover requires export, mapping into Room Model v2, object transfer to durable Storage, reconciliation, and rollback evidence before production promotion.

### Canonical source and release path
- `Ryan9876/devpak` is the canonical source repository. Application source must not be reconstructed from Vercel deployment artifacts during normal development.
- Changes are developed on `parallax/...` branches, validated at a tier proportional to the boundary changed, preview-deployed once, then promoted after live acceptance.
- Preview builds may bootstrap an immutable canonical GitHub commit to avoid hand-reconstructed inline source packages; the bootstrap is deployment-only and verifies the expected source before domain/build validation.
- Runtime dependencies are pinned. `sharp` is pinned for deterministic alpha compositing. Secrets and private environment-specific values remain outside source control.
- Validation tiers are change-aware: presentation-only, Room Model/domain, backend/auth/schema, and full architecture/build. Heavy database/security gates are not rerun for unrelated CSS-only edits.
