---
"@joshthompson/scoopjs": patch
---

Adds `skipChildren`, a Scene option for benchmarking only. With it on, neither Renderer draws any Sprite's `children`, so the DOM Renderer and the Canvas Renderer can be compared drawing the same Frames and nothing else.
