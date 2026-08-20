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

## Direct manipulation in Geometry
- Picking up a movable object preserves the exact grab point; objects must not jump to the pointer center.
- Pointer movement is visually continuous. The 50 mm Room Model grid is applied on release, not on every pointer-move frame.
- Movement is clamped to room bounds during drag. Fixed-object/opening conflicts may be previewed while moving, but an invalid release must revert to the last valid persisted position.
- A successful release performs deterministic placement validation and one durable persistence write using the final snapped coordinates.
- Dragging uses explicit lift/grab feedback and nearby conflict guidance; fixed objects never present a draggable cursor.

Requirements: 44px minimum interactive targets, visible focus states, no browser-default primary controls, responsive one-column fallback, status/conflict messages adjacent to the affected action, and confidence/verification state presented in text rather than color alone.
