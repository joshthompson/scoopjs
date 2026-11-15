# T1: Frame stepping moves into the Controller

Blocked by: none
Status: done, merged into canvas-renderer in 257efb3

Spec: [canvas-spec.md](../canvas-spec.md). User stories 31–38. Implementation Decisions → Modules → Controller, Scene and DOM Renderer (frame stepping). Testing Decisions → Seam 1.

Move a Sprite's current Frame and how it advances (`frameInterval`, `randomStartFrame`, a controlled `frame`, play/pause `state`, and the `'tick'` and `'display'` frame clocks) out of the DOM `Sprite` component and into the Controller.

- The Scene steps its Controllers' Frames. Carriers step their Attached Controllers.
- `$currentFrame` reads the Controller's value directly, and the old report-back from the Sprite goes away.
- The DOM Sprite reads its Frame from the Controller.
- The exported `Sprite` keeps a fallback stepper for use without a Controller.
- Animation stays paused while a Modal is up or the Scene is loading, as now.

Done when Seam 1 tests cover:
- intervals that aren't a whole number of Ticks
- `randomStartFrame`
- a controlled `frame`
- play/pause
- pausing under a Modal and while loading
- Attached Controllers
- both frame clocks

Add a changeset (minor).
