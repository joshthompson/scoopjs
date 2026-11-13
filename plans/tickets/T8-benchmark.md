# T8: Benchmark stress page and children switch

Blocked by: T4

Spec: [canvas-spec.md](../canvas-spec.md). User stories 74–75. [canvas.md](../canvas.md) → Phase 3.

- **A stress page** in this repo, outside the published package (e.g. a private workspace package under `bench/` that runs with Vite). It shows N moving, animated, rotated sprites, from 100 to 5,000, under a Renderer you can switch, with frame time shown on the page.
- **A bench switch** that skips `children` in both Renderers, for comparing run-game fairly. Keep it small and clearly marked as for benchmarking, e.g. a Renderer prop, or a Scene option if both Renderers need it.

The run-game profiling and the ported course happen in the scoopbusrunclub repo and aren't part of this ticket.

Done when `pnpm` can start the page, both Renderers run on it, and the switch is tested. Add a changeset (patch) if the switch is public API.
