---
"@joshthompson/scoopjs": minor
---

A Controller can paint its own Sprite under the Canvas Renderer with a Draw Hook: a `draw` option on `createController`, for clip paths, gradients, text and shapes the Canvas Renderer can't get from style.

- It's called with `ctx`, already moved into the Sprite's own box, so it draws from (0, 0) to (width, height). It's also given `drawDefault()`, which paints the current Frame there, so it can draw over or under it, and `$`, `$scene` and `$currentFrame`.
- Whatever it sets on the context is undone after it.
- Attached Controllers are still painted after it.
- The DOM Renderer ignores it, so one Controller can keep its `children` for the DOM and use `draw` for canvas.

A Controller made with one has a `draw` of its own, and one made without has none.
