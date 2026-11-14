---
"@joshthompson/scoopjs": patch
---

The Canvas Renderer now paints at its size on the screen: the Renderer's size, times any CSS transform scaling it or anything it's in, times `devicePixelRatio`. A stage scaled to fit the window, or zoomed with `transform: scale(...)`, is no longer stretched by the browser, so sprites and pixel art stay as sharp as under the DOM Renderer. Frames and Draw Hooks still paint in the scene's pixels, and drop-shadows keep their size. A zoom animated with `scale()` only resizes the canvas when it's a fifth bigger or smaller on the screen, or once it's stopped. The canvas is never more than 16 million pixels, under iOS's limit for one canvas. Under `pixelated`, a sprite that isn't rotated or skewed is painted from a whole pixel of the screen, so its edges aren't blended.

A `drop-shadow`'s blur is now as wide on the canvas as on the page. It was half as wide: a canvas blurs by half its `shadowBlur`, where `drop-shadow` blurs by all of its length.
