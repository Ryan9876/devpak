# NestMetric Design System

Calm spatial-tool aesthetic: warm neutral canvas, restrained forest-green primary actions, clay measurement accent, high-contrast dark text, subtle surfaces and minimal decoration. The room canvas is the primary working surface; forms and inspectors support it rather than dominate it.

## Spatial workspace hierarchy
- The room canvas is visually dominant and must preserve the Room Model's physical aspect ratio rather than stretching independently on each axis.
- Object lists and inspectors stay compact and secondary. Capture and measurement workflows use progressive disclosure when they are not the user's immediate task.
- Selected, fixed, dragging and invalid-placement states must be distinguishable without relying on color alone.
- Status text is contextual to the active interaction; stale placement errors should not remain attached to unrelated selections.

## Direct manipulation
- Picking up a movable object preserves the exact grab point; objects must not jump to the pointer center.
- Pointer movement is visually continuous. The 50 mm Room Model grid is applied on release, not on every pointer-move frame.
- Movement is clamped to room bounds during drag. Fixed-object/opening conflicts may be previewed while moving, but an invalid release must revert to the last valid persisted position.
- A successful release performs deterministic placement validation and one durable persistence write using the final snapped coordinates.
- Dragging uses explicit lift/grab feedback and nearby conflict guidance; fixed objects never present a draggable cursor.

Requirements: 44px minimum interactive targets, visible focus states, no browser-default primary controls, responsive one-column fallback, status/conflict messages adjacent to the affected action, and confidence/verification state presented in text rather than color alone.
