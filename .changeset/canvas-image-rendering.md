---
"@joshthompson/scoopjs": minor
---

The Canvas Renderer now draws `image-rendering` from a Controller's `style`, rather than reporting it as a Canvas Issue. `pixelated` and `crisp-edges` turn image smoothing off for that Sprite, and for its Attached Controllers unless they say otherwise, as CSS inherits it. `auto` and `smooth` leave it to the Renderer's `pixelated` prop, which still turns it off for every Sprite. Any other value is a Canvas Issue, with the value.
