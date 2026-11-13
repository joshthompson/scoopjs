# T4: Canvas Renderer base

Blocked by: T1, T2, T3

Spec: [canvas-spec.md](../canvas-spec.md). User stories 1–30. Implementation Decisions → Canvas Renderer, and the Contracts for draw order, Frame cropping, repainting and the backing store. Testing Decisions → Seam 2.

A `CanvasRenderer` component in Core, exported next to `DomRenderer`, with the same props plus `pixelated`. It includes:

- **Painting.** A repaint on `requestAnimationFrame`, only when something changed: a Tick, a Ticker, the camera, a resize or an image load.
- **Draw order.** `assetOrder`, then the order Controllers were added, then Attached Controllers after their carrier inside its transform. Use T2's geometry for transforms, so painting and hit testing agree.
- **Frames.** Load images, crop sheets as in the Contracts (including wrapping and negative offsets), and paint resolved assets.
- **Sizing.** A backing store sized to the device pixel ratio, and `pixelated` turning smoothing off.
- **Off screen.** Sprites outside the view are skipped.
- **Page elements.** The UI layers and input handlers work as in `DomRenderer`.

No style translation yet: that's T5. Ignore style for now.

Set up Seam 2: a test helper that stubs `HTMLCanvasElement.prototype.getContext` to return a context that records every call and property set. T5–T7 will reuse it, so make it easy to extend.

Done when Seam 2 tests cover:
- draw order
- crops
- transforms
- skipping off-screen Sprites
- repainting only after a change
- device-pixel-ratio sizing

Add a changeset (minor).
