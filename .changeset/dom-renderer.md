---
"@joshthompson/scoopjs": minor
---

`Canvas` is now `DomRenderer`, and `CanvasProps` is `DomRendererProps`. It draws exactly as before, and "canvas" is left free for the `<canvas>` element the Canvas Renderer will paint on.

`Canvas` and `CanvasProps` still work, as deprecated aliases, until 1.0. The scene's own `canvas` (its camera and size) and the `Canvas` type it holds keep their names.
