---
"@joshthompson/scoopjs": minor
---

The Canvas Renderer now draws the parts of a Controller's `style` a canvas can reproduce, with no new props to learn:

- `opacity`, multiplied through carriers, as nested elements fade together on the page.
- `visibility: hidden`, which Attached Controllers inherit unless they say `visible`, and `display: none`, which hides everything a Controller carries.
- `z-index`, `transform` (`translate`, `scale`, `rotate` and `skew`), `translate` and `transform-origin`, as before.
- `filter` with `hue-rotate`, `brightness`, `sepia` and `saturate`, a carrier's filter applying to its parts too. Where the canvas has no `filter` of its own, as on WebKit and so every iPhone, each image is recoloured once for each filter value, rounded to a whole degree for hue and 0.01 for the rest, and the copies kept, so an animated filter stays smooth.
- `filter: drop-shadow(...)`, through the canvas's own shadow, turned and scaled with the Sprite. A canvas casts one shadow, so only the first is drawn.

`scene.controllersAt(point)` now leaves out Controllers hidden by `visibility` or `display: none`, under either Renderer.
