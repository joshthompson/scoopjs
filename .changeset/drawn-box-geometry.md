---
"@joshthompson/scoopjs": minor
---

`hitTest` now compares where two Controllers are drawn, rather than their raw `x`, `y`, `width` and `height`. That takes in Attached Controllers composed through every carrier, rotation, scale, flips, `origin`, a style's `transform`, `translate` and `transform-origin`, parallax and the camera, so collisions match what the player sees.

New: `scene.controllersAt(point)` gives the Controllers drawn under a point, topmost first, in the DOM Renderer's order (`assetOrder`, then the order they were added, Attached Controllers straight after their carrier, and `z-index`). `point` is in the coordinates the Renderer's `onClick`, `onMouseDown` and `onMouseUp` give.

New: `controller.carrier()` is the Controller it's attached to, if any.
