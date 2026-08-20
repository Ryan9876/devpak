# NestMetric Architecture

## Phase 2 target architecture
NestMetric uses one canonical Room Model across web capture, optional iOS/LiDAR capture, Organize, Arrange, Build, deterministic validation, and AI-assisted proposals.

### Runtime
- Next.js App Router on Vercel.
- Supabase project `yyrpennpmwajlbepoemt` provides managed PostgreSQL, Auth, and private object Storage for the durable production backend.
- Supabase SSR cookie clients are request-scoped; server authorization uses verified claims rather than trusting client session payloads.

### Authentication
- Google OAuth is initiated through the server route `/auth/google`, not directly from browser-side Supabase JavaScript.
- The server-side Supabase SSR client creates the PKCE authorization flow and redirects the browser to Google through Supabase Auth.
- Google returns to Supabase Auth, which redirects to NestMetric `/auth/callback`; that route exchanges the authorization code for the cookie-backed session before entering `/studio`.
- Email magic-link authentication uses the same `/auth/callback` session boundary and remains a fallback path.
- OAuth provider secrets live in Supabase provider configuration. Browser/runtime code receives only the Supabase project URL and publishable key.

### Canonical Room Model
- Integer micrometre coordinate system prevents floating-point drift in physical dimensions.
- Room bounds, openings, fixed objects, movable objects, assets, and measurement evidence share one coordinate contract.
- Measurement evidence records source, confidence, tolerance, device/calibration context, verification, and correction history.
- LiDAR/RoomPlan is an optional evidence source into this same model, never a separate product path.

### Safety / feasibility boundary
- Deterministic geometry validation is authoritative for bounds, clearances, openings, fixed-obstacle collisions, and snapping.
- AI may propose layouts/designs but does not bypass deterministic feasibility checks.
- Build plans remain gated until required dimensional evidence is verified or explicitly corrected by the user.

### Persistence / ownership
- Owner-scoped relational rows are protected with RLS.
- Room photos/assets use a private Storage bucket whose object path is rooted by authenticated user id.
- Production application data must use Supabase PostgreSQL and private Storage; Vercel local filesystem storage is not an authoritative persistence layer.

### Migration
The existing SQLite/filesystem implementation is treated as a legacy source. Cutover requires export, mapping into Room Model v2, object transfer to durable Storage, reconciliation, and rollback evidence before production promotion.

### Canonical source and release path
- `Ryan9876/devpak` is the canonical source repository. Application source must not be reconstructed from Vercel deployment artifacts during normal development.
- Changes are developed on `parallax/...` branches, validated at a tier proportional to the boundary changed, preview-deployed once, then promoted after live acceptance.
- Runtime dependencies are pinned. Environment-specific values are supplied outside source control; `.env.production` is not a source artifact.
- Validation tiers are change-aware: presentation-only, Room Model/domain, backend/auth/schema, and full architecture/build. Heavy database/security gates are not rerun for unrelated CSS-only edits.
