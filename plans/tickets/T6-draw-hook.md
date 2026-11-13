# T6: Draw Hook

Blocked by: T4

Spec: [canvas-spec.md](../canvas-spec.md). User stories 55–60. Contracts → Draw Hook, including its type shape.

- A `draw` option on `createController`.
- The Canvas Renderer calls it with a context already in the Sprite's box, along with `drawDefault()`, `$`, `$scene` and `$currentFrame`.
- Attached Controllers are still painted after it.
- The DOM Renderer ignores it.

Done when Seam 2 tests cover:
- the context is transformed into the box
- `drawDefault()` paints the current Frame
- attached parts are painted after
- it isn't called under the DOM Renderer

Add a changeset (minor).
