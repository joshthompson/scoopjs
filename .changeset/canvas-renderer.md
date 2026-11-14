---
"@joshthompson/scoopjs": minor
---

A second Renderer, `CanvasRenderer`, paints every Sprite onto one `<canvas>`. A game tries it by mounting it in place of `DomRenderer`, with the same props: the Scene and its Controllers don't change.

- Sprites are painted in the same order the DOM Renderer draws them: `assetOrder`, then the order they were added, with Attached Controllers straight after their carrier, and `z-index` sorting within each.
- Plain Frames are stretched to the Sprite, and `url#x,y,w,h` sprite sheets are cropped as the DOM Renderer crops them, offsets wrapping round the sheet. Images go through the Scene's `resolveAsset`.
- It repaints at most once a display frame, and only after a Tick, a Ticker, the camera moving, a resize or an image loading. Sprites outside the view aren't painted.
- The canvas is drawn at the screen's pixel density. The new `pixelated` prop turns smoothing off, for pixel art.
- The underlay, overlay, dialogs, Modal and loading screen stay page elements, and the pointer handlers give the same scene coordinates as the DOM Renderer's.

A Sprite's `style`, `children` and `class` aren't drawn yet.
