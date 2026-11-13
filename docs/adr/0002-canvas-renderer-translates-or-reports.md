# The Canvas Renderer translates the CSS it can and reports the rest

A game opts into the Canvas Renderer by putting it on the page in place of the DOM Renderer. The Scene doesn't know which one draws it. The Canvas Renderer never emulates the DOM.

- It honours the `style` keys it can reproduce on a canvas: `opacity`, `visibility`, `display: none`, `z-index`, a fixed set of `filter` functions, and `transform`, `translate` and `transform-origin`.
- Everything else draws nothing. This covers `children`, `class`, `inner.style`, a read of `$ref`, and the other `style` keys such as `clip-path`, `transition` and gradients.
- For each Controller type and feature, the first time one of these is drawn it logs one `console.error`. The error has a fixed `[scoopjs:canvas]` prefix and the place the Controller was created, so an agent can work through them. `scene.canvasIssues()` returns the same list.

## Considered Options

- **A DOM layer for `children`**, with page elements following each sprite over the canvas. We rejected it because those elements would always sit above every painted sprite, which breaks draw order, and because they bring back the DOM cost the Canvas Renderer exists to remove. run-game draws about 65 Controllers through `children`.
- **Rasterising `children`** to bitmaps through SVG `foreignObject`. We rejected it as slow and fragile, with fonts and CSS animations unreliable.
- **Outlining unsupported sprites on the canvas**. Rejected in favour of console errors, which an agent can read.
- **New typed Sprite props** (`opacity`, `visible`, `zIndex`, a filter object) instead of translating `style`. Rejected because a game would have two ways to say the same thing. Translating `style` also means porting a game changes nothing it doesn't have to.
- **Choosing the renderer with a Scene option, or per Controller.** Rejected so that the Scene stays independent of what draws it (rule 2 in the old plan), and because mixing DOM and canvas sprites in one Scene breaks draw order.

## Consequences

- A problem is only found when it's drawn, since `style` can change during play. Finding them all means playing through the levels.
- Canvas `ctx.filter` isn't available on every browser (WebKit, so every iPhone). Where it's missing, filters fall back to a cache of recoloured Frames, with values rounded. `drop-shadow` uses the canvas's own shadow settings.
- An animated SVG Frame shows only its first frame.
