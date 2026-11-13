# T7: Canvas Issues

Blocked by: T5, T6

Spec: [canvas-spec.md](../canvas-spec.md). User stories 61–73. Implementation Decisions → Issue reporter, and Contracts → Canvas Issue and `$ref`. ADR 0002.

- The Controller records a stack when it's created, for "created at".
- The Canvas Renderer reports:
  - `children`, `class`, `inner.style`
  - untranslatable style keys (from T5), and filter functions outside the supported set
  - a read of `$ref` (`onMount`'s `$ref` becomes a getter returning `undefined` under canvas)
  - DOM-only Scene options
- Each is reported once per Controller type and feature, the first time it's drawn, as a `console.error` starting with `[scoopjs:canvas]`, in the format shown in [canvas.md](../canvas.md).
- `scene.canvasIssues()` returns the same records.
- A Controller with a Draw Hook isn't reported for `children` or untranslatable style.
- Nothing is painted for any of these. There are no markers.

Done when Seam 2 tests cover:
- each kind of issue
- once per type and feature
- the prefix and "created at"
- `canvasIssues()`
- the Draw Hook silencing them
- an `onMount` that doesn't read `$ref` not being reported

Add a changeset (minor).
