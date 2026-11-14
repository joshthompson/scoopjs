---
"@joshthompson/scoopjs": minor
---

A Controller's `drawReach` says how far its Draw Hook paints past its Sprite's box, so the Canvas Renderer paints it while any of that is in view, rather than skipping it once its box is off camera. `createConnectedController` takes it too.
