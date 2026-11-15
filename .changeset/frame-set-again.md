---
"@joshthompson/scoopjs": patch
---

Jump to a Sprite's `frame` again when a game sets it after leaving it unset. A runner standing on Frame 0, then running with no `frame`, then set back to Frame 0 stayed on a running Frame instead, and with fewer Frames by then, showed none.
