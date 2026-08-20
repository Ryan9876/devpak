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
- AI visual proposals are separate private assets, never replacements for source photos. Their `capture_context.captureMethod` is `ai_photo_proposal` and records the source asset, mode, goal, model, and generation time.
- The server downloads the authenticated owner's private source photo, sends it to the image-edit provider, stores the generated result back into the same private owner-scoped asset domain, and returns only a short-lived signed URL to the client.
- Provider credentials remain server-only. No AI provider secret is committed to source or exposed to the browser.
- Visual proposals do not mutate Room Model coordinates, measurements, constraints, or build-readiness evidence. The original image remains available as the stable comparison reference.
- A top-down Room Model is not assumed to be calibrated to a perspective photograph. Any future object-level photo manipulation tied to measured coordinates requires an explicit photo-to-room calibration/projection contract rather than visually pretending the two coordinate systems already correspond.

### Canonical Room Model
- Integer micrometre coordinate system prevents floating-point drift in physical dimensions.
- Room bounds, openings, fixed objects, movable objects, assets, and measurement evidence share one coordinate contract.
- Measurement evidence records source, confidence, tolerance, device/calibration context, verification, and correction history.
- LiDAR/RoomPlan is an optional evidence source into this same model, never a separate product path.
- Geometry is surfaced to users as a secondary precision view rather than the default application metaphor.

### Safety / feasibility boundary
- Deterministic geometry validation is authoritative for bounds, clearances, openings, fixed-obstacle collisions, and snapping.
- AI may propose visual outcomes/layouts/designs but does not bypass deterministic feasibility checks.
- Photorealistic appearance is not evidence of dimensional accuracy.
- Build plans remain gated until required dimensional evidence is verified or explicitly corrected by the user.

### Persistence / ownership
- Owner-scoped relational rows are protected with RLS.
- Room source photos and generated visual assets use a private Storage bucket whose object path is rooted by authenticated user id.
- Production application data must use Supabase PostgreSQL and private Storage; Vercel local filesystem storage is not an authoritative persistence layer.

### Migration
The existing SQLite/filesystem implementation is treated as a legacy source. Cutover requires export, mapping into Room Model v2, object transfer to durable Storage, reconciliation, and rollback evidence before production promotion.

### Canonical source and release path
- `Ryan9876/devpak` is the canonical source repository. Application source must not be reconstructed from Vercel deployment artifacts during normal development.
- Changes are developed on `parallax/...` branches, validated at a tier proportional to the boundary changed, preview-deployed once, then promoted after live acceptance.
- Runtime dependencies are pinned. Secrets and private environment-specific values remain outside source control; `.env.production` is not a source artifact. Public project identifiers such as the Supabase URL/publishable key may have dedicated-project defaults when required for deployment reliability.
- Validation tiers are change-aware: presentation-only, Room Model/domain, backend/auth/schema, and full architecture/build. Heavy database/security gates are not rerun for unrelated CSS-only edits.
