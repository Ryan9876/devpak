# NestMetric Architecture

## Phase 2 target architecture
NestMetric uses one canonical Room Model across web capture, optional iOS/LiDAR capture, Organize, Arrange, Build, deterministic validation, and AI-assisted proposals.

### Runtime
- Next.js App Router on Vercel.
- Supabase project `yyrpennpmwajlbepoemt` provides managed PostgreSQL, Auth, and private object Storage for the durable production backend.
- Supabase SSR cookie clients are request-scoped; server authorization uses verified claims rather than trusting client session payloads.

### Canonical Room Model
- Integer micrometre coordinate system prevents floating-point drift in physical dimensions.
- Room bounds, openings, fixed objects, movable objects, assets, and measurement evidence share one coordinate contract.
- Measurement evidence records source, confidence, tolerance, device/calibration context, verification, and correction history.
- LiDAR/RoomPlan is an optional evidence source into this same model, never a separate product path.

### Safety / feasibility boundary
- Deterministic geometry validation is authoritative for bounds, clearances, openings, fixed-obstacle collisions, and snapping.
- AI may propose layouts/designs but does not bypass deterministic feasibility checks.
- Build plans remain gated until required dimensional evidence is verified or explicitly corrected by the user.

### Build artifacts
- Build requests supply the desired build type, overall dimensions and material preference; image-derived estimates do not silently become construction dimensions.
- The deterministic Build generator requires verified/corrected wall width and wall depth evidence before generation.
- Candidate placement is checked against the same Room Model geometry/opening/fixed-object boundary used by Arrange.
- Generated artifacts contain overall dimensions, placement, clearances, component dimensions, material quantities/waste allowance, assumptions, verification snapshot, and nonbinding cost/effort ranges.
- A conflicted build may be saved for iteration but is explicitly not presented as ready.
- Durable build artifacts are stored in owner-scoped `build_plans`; the verification snapshot preserves the dimensional evidence used when the plan was generated.
- AI may later enrich design intent or alternatives, but deterministic dimensions, evidence gating and conflict validation remain authoritative.

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
