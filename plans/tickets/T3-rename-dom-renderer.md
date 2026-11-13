# T3: Rename `Canvas` to `DomRenderer`

Blocked by: none

Spec: [canvas-spec.md](../canvas-spec.md). User story 3. Implementation Decisions → Modules → DOM Renderer.

- Rename the `Canvas` component (and `CanvasProps`) to `DomRenderer` (`DomRendererProps`).
- Keep `Canvas` and `CanvasProps` as deprecated aliases with a `@deprecated` JSDoc.
- Update the docs, comments and README that call it Canvas, using the glossary's terms. "Canvas" now only means the `<canvas>` element.
- Leave the Scene's own `canvas` signal (camera and size) alone. Renaming it would break games for no benefit.

Done when typecheck, lint and tests pass and the aliases still compile. Add a changeset (minor).
