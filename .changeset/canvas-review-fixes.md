---
"@joshthompson/scoopjs": minor
---

Fixes from reviewing the Canvas Renderer:

- Attached Controllers more than one level deep, such as a hand on an arm on a runner, are now found by `getAllControllers`, `getControllerById` and `getControllersByType`. Under the Canvas Renderer their `onMount` runs, and their Frames stepping repaints the canvas.
- A still Scene no longer repaints every Tick. A paused Tick repaints only if the game runs something of its own in it, its own Tickers or `afterEnterFrames`, or if the Controllers moved in the Tick before.
- A value the Canvas Renderer can't read in a key it translates, such as `opacity: var(--o)` or `translate: 1em 2em`, is now a Canvas Issue, named with its value: `style.opacity var(--o)`.
- An image that fails to load is reported once per Controller type, as the feature `image`, with the failing URL in the new `url` field and on the console.
- `AnyController`, a Controller of any shape, is exported.
- On WebKit, a Draw Hook's own drawing isn't tinted by colour filters, only `drawDefault()` is. That's now documented.
