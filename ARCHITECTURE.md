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
- The server downloads the authenticated owner's private source photo and passes the image bytes as a reference image to AI SDK `generateImage()` using `openai/gpt-image-2` through Vercel AI Gateway. The generated result is stored back into the same private owner-scoped asset domain and only a short-lived signed URL is returned to the client.
- Vercel-hosted AI Gateway requests use deployment identity/OIDC rather than an OpenAI API key embedded in application configuration. Provider credentials are not committed to source or exposed to the browser. A local/non-Vercel development environment may use an explicitly configured Gateway credential when needed.
- Reference-image prompts preserve camera viewpoint, room shell, perspective, scale, occlusion, lighting direction, and recognizable surfaces and explicitly reject CAD drawings, floor plans, labels, dimensions, watermarks, or UI in generated images.
- Visual proposals do not mutate Room Model coordinates, measurements, constraints, or build-readiness evidence. The original image remains available as the stable comparison reference.
- A top-down Room Model is not assumed to be calibrated to a perspective photograph. Photo-space manipulation therefore uses an explicit image-space scene contract rather than pretending Room Model coordinates map directly into the photograph.

### Photo scene interaction layer
- Direct photo manipulation uses a source-photo-owned `PhotoScene` stored in that source asset's `capture_context.scene`. It is versioned independently from the measured Room Model and uses normalized image coordinates (`0..1`) so interactions remain stable across responsive rendering sizes.
- A `PhotoScene` contains support-surface polygons, visual items, item support relationships, support-plane footprints, and calibration provenance. The current v1 calibration is manual; future vision/depth segmentation may emit the same contract as `vision_assisted` rather than creating a parallel interaction architecture.
- Movable objects use a bottom-center support point and a support-plane footprint. Collision is evaluated between footprints on the same support surface, so soft visual extents such as plant leaves do not behave like rigid collision boxes.
- Functional gravity is deterministic support resolution, not a general rigid-body physics engine. If a released item has no valid support at its current location, a vertical image-space ray resolves the next lower compatible surface; the item settles there at a perspective-adjusted visual scale or rejects when no valid landing exists.
- Support surfaces have an explicit visual-depth order. Current examples include dresser top, bed, and floor. The system may therefore settle an object onto a bed before the floor when that is the nearest visible lower support.
- Blocked placement may snap to the nearest clear position on the same surface; otherwise it reverts. Surface, blocker, and gravity feedback is contextual during the active drag and is not shown as persistent CAD-style markup.
- Scene position changes persist only to the source photo's scene metadata and do not mutate Room Model measurements, object coordinates, constraints, or Build readiness.
- Because generated photo proposals are required to preserve the source camera viewpoint, the source-photo scene calibration can be reused as an interaction overlay for aligned proposals. If a proposal materially changes viewpoint or scene topology, it must be treated as uncalibrated until a new projection/scene contract exists.
- v1 visual object movement uses the source-photo crop as the draggable augmentation and masks/softens the source location. High-quality segmentation/inpainting is a future rendering refinement; it does not change the support/collision/gravity contract.

### Canonical Room Model
- Integer micrometre coordinate system prevents floating-point drift in physical dimensions.
- Room bounds, openings, fixed objects, movable objects, assets, and measurement evidence share one coordinate contract.
- Measurement evidence records source, confidence, tolerance, device/calibration context, verification, and correction history.
- LiDAR/RoomPlan is an optional evidence source into this same model, never a separate product path.
- Geometry is surfaced to users as a secondary precision view rather than the default application metaphor.

### Safety / feasibility boundary
- Deterministic geometry validation is authoritative for bounds, clearances, openings, fixed-obstacle collisions, and snapping.
- Deterministic photo-scene support/collision/gravity rules are authoritative for direct photo manipulation; AI imagery does not override them.
- AI may propose visual outcomes/layouts/designs but does not bypass deterministic feasibility checks.
- Photorealistic appearance is not evidence of dimensional accuracy.
- Build plans remain gated until required dimensional evidence is verified or explicitly corrected by the user.

### Persistence / ownership
- Owner-scoped relational rows are protected with RLS.
- Room source photos and generated visual assets use a private Storage bucket whose object path is rooted by authenticated user id.
- Source-photo scene metadata is persisted in the owner-scoped source asset row under `capture_context.scene`; photo manipulation does not require a new database table for v1.
- Production application data must use Supabase PostgreSQL and private Storage; Vercel local filesystem storage is not an authoritative persistence layer.

### Migration
The existing SQLite/filesystem implementation is treated as a legacy source. Cutover requires export, mapping into Room Model v2, object transfer to durable Storage, reconciliation, and rollback evidence before production promotion.

### Canonical source and release path
- `Ryan9876/devpak` is the canonical source repository. Application source must not be reconstructed from Vercel deployment artifacts during normal development.
- Changes are developed on `parallax/...` branches, validated at a tier proportional to the boundary changed, preview-deployed once, then promoted after live acceptance.
- Runtime dependencies are pinned. Secrets and private environment-specific values remain outside source control; `.env.production` is not a source artifact. Public project identifiers such as the Supabase URL/publishable key may have dedicated-project defaults when required for deployment reliability.
- Validation tiers are change-aware: presentation-only, Room Model/domain, backend/auth/schema, and full architecture/build. Heavy database/security gates are not rerun for unrelated CSS-only edits.
