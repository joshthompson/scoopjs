---
"@joshthompson/scoopjs": minor
---

Frames now step inside the Controller, not the DOM Sprite. The Scene steps every Controller's Frames once a Tick (or on its own display refresh with `frameClock: 'display'`), and carriers step their Attached Controllers. `$currentFrame` is now exactly the Frame on screen, rather than a Tick behind, and a Controller's Frame can be read with `controller.currentFrame()`. `frameInterval`, `randomStartFrame`, a controlled `frame` and play/pause `state` behave as before, and animation still pauses under a Modal and while loading. The exported `Sprite` still steps its own Frames when it's used without a Controller.
