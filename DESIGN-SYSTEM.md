# NestMetric Design System

Calm functional-photo aesthetic: warm neutral application chrome, restrained forest-green primary actions, clay measurement accents, high-contrast dark text, subtle surfaces, and minimal decoration. The real room photo is the primary working surface. Geometry, forms, lists, and inspectors support the photo experience rather than dominate it.

## Workspace hierarchy
- Photo is the default and visually dominant Studio view for Organize, Arrange, and early Build exploration.
- The original room photo must always remain available when generated visual proposals exist.
- AI-generated visuals are labeled as visual concepts and must be visually distinguishable from the original photo and from measured/verified truth.
- Geometry is a secondary precision view. It preserves the Room Model's physical aspect ratio, supports deterministic placement/verification, and becomes more prominent only when the task genuinely requires dimensional precision.
- Do not make the core experience look or behave like CAD: avoid persistent grids, coordinates, dimension callouts, technical controls, or plan-first composition in the primary photo workflow.
- Object lists, measurements, and inspectors stay compact and secondary. Measurement workflows use progressive disclosure until precision is relevant.
- Status and conflict feedback is contextual to the active interaction; stale errors must not remain attached to unrelated selections or photo proposals.

## Photo augmentation
- Capturing or choosing a room photo is a first-class central workflow, not a sidebar utility.
- Visual proposals preserve the photographed viewpoint and should read as believable changes to the same room rather than as mood boards, diagrams, or unrelated renderings.
- Proposal history uses lightweight thumbnails/filmstrip navigation with the original photo treated as the stable reference.
- Generated imagery never implies measured accuracy by appearance alone. When Build precision matters, direct the user to verified measurements and Geometry.
- Source-photo derivatives used for manipulation—background plates, exact-pixel cutouts, masks, or similar internal assets—must never appear as user-facing source photos or proposal-history entries.
- Visual Proposals are explicitly **view-only** unless and until they receive their own calibration contract. The UI must say this directly rather than relying on the user to infer it.
- When a proposal is active, the photo surface must direct the user back to **Original** for direct manipulation.

## Direct manipulation in Photo
- Direct manipulation happens on the original calibrated room photo. Generated visual proposals remain view-only unless they receive their own explicit calibration contract later.
- The live drag representation must preserve the photographed object's original pixels. AI-generated object recreations are not acceptable as the primary manipulation layer because they can change identity, texture, leaves, edges, lighting, or shape.
- A movable object is extracted from the immutable source photo through an explicit segmentation mask and stored/rendered as a transparent exact-pixel cutout over a clean reconstructed background plate.
- AI may prepare only the hidden-surface reconstruction needed behind the object. Whole-room regeneration is not an acceptable background-preparation strategy for direct manipulation.
- The localized background-preparation mask should be slightly expanded/feathered around the object edge to remove source-edge remnants while preserving the rest of the photograph unchanged in content.
- The original source image remains immutable. Removing an object from its source location is represented by a separate background plate, never by destructive editing of the source asset.
- Picking up an object preserves the exact touch/grab offset. The object follows the finger continuously without snapping while moving.
- On touch devices, the photo manipulation surface suppresses native image callouts/context menus so long-press/drag is owned by NestMetric rather than Safari/OS image actions.
- Support, collision, and gravity feedback may appear only while relevant. Support surfaces and blocker regions are interaction diagnostics, not permanent visual overlays.
- A selected object uses only a restrained edge/halo effect derived from the object silhouette. Persistent object-name pills, rectangular selection boxes, corner handles, or CAD-like controls are not part of the normal photo state.
- A placed object receives a subtle contact shadow appropriate to its support surface. Shadows support visual grounding but do not imply physical simulation accuracy.
- Foreground occlusion should preserve scene depth when a moved object belongs behind a photographed foreground element. Occlusion masks remain invisible to the user.
- Unsupported release invokes deterministic gravity to the nearest lower valid support. Collision resolution and support validity remain deterministic regardless of visual compositing quality.
- Visual scale may change modestly with image-space depth to maintain perspective, but must not be presented as a measurement.
- Scene preparation should be reusable and idempotent: once a localized clean background and exact-pixel cutout exist for the source photo/object calibration, pointer movement never requires image generation.
- If the exact-pixel segmentation path is unavailable, a crop-based fallback may keep the interaction usable, but it is a temporary degradation state and should not be mistaken for target visual quality.

## Direct manipulation in Geometry
- Picking up a movable object preserves the exact grab point; objects must not jump to the pointer center.
- Pointer movement is visually continuous. The 50 mm Room Model grid is applied on release, not on every pointer-move frame.
- Movement is clamped to room bounds during drag. Fixed-object/opening conflicts may be previewed while moving, but an invalid release must revert to the last valid persisted position.
- A successful release performs deterministic placement validation and one durable persistence write using the final snapped coordinates.
- Dragging uses explicit lift/grab feedback and nearby conflict guidance; fixed objects never present a draggable cursor.

Requirements: 44px minimum interactive targets, visible focus states, no browser-default primary controls, responsive one-column fallback, status/conflict messages adjacent to the affected action, and confidence/verification state presented in text rather than color alone.
