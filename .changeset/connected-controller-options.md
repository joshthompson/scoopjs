---
"@joshthompson/scoopjs": patch
---

`createConnectedController` now uses every option it takes. `width` and `height` are given the base's data, as their type says, `xScale` flips the part, `solid` is kept on it, and `transformOrigin` works as a deprecated name for `origin`. Before, `width` and `height` were called without the data, and the other three were ignored.
