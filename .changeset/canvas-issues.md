---
"@joshthompson/scoopjs": minor
---

The Canvas Renderer reports what it can't draw as Canvas Issues, rather than leaving it out silently.

- It reports `children`, `class`, `inner.style`, every `style` key it doesn't translate, `filter` and `transform` functions outside the ones it does, a read of `$ref` in `onMount`, a Frame whose image fails to load, and the Scene's DOM-only options (`cameraLayer`, `standbyFrames`).
- Each is reported once per Controller type and feature, the first time it's drawn, with `console.error`. The message starts with `[scoopjs:canvas]` and gives an example id, where the Controller was created, and how to fix it:

  ```
  [scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")
    created at src/draw/sprites.tsx:2787
    fix: clip with ctx.clip() in a Draw Hook
  ```
- `scene.canvasIssues()` returns the same records as plain objects (the `CanvasIssue` type), so one call gives the whole list.
- A Controller with a Draw Hook isn't reported for its `children` or the style it looks like.
- `onMount` now runs under the Canvas Renderer too. Its `$ref` is undefined there, and only reading it is reported.
- Nothing is painted to mark an issue.
