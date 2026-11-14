# T2: Drawn-box geometry, `hitTest` on drawn boxes and `controllersAt`

Blocked by: none
Status: done, merged into canvas-renderer in 9ab2f33

Spec: [canvas-spec.md](../canvas-spec.md). User stories 39–45. Implementation Decisions → Modules → Drawn-box geometry, and Further Notes → transform order. Testing Decisions → Seam 1.

A deep module: given a Controller and the Scene's camera, it returns the axis-aligned box where the Controller is drawn. It composes position, size, scale, flips, rotation, origin and the `transform` from style through every carrier, then applies parallax.

- `controller.hitTest(other)` compares drawn boxes.
- `scene.controllersAt(point)` returns the Controllers whose drawn box contains a point on the screen, topmost first, in the draw order defined in the spec's Contracts.

Today's DOM Sprite (`Sprite.tsx`) is the reference for how these compose. Match where the DOM actually draws things.

Done when Seam 1 tests cover:
- attached parts, including nested rotation
- flips
- origin
- style transforms
- parallax
- the camera
- topmost-first ordering

Add a changeset (minor).
