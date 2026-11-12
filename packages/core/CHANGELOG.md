# @joshthompson/scoopjs

## 0.2.0

### Minor Changes

- [`097563c`](https://github.com/joshthompson/scoopjs/commit/097563cd2de5a6468c08fcc3d2548d25ef5ea618) Thanks [@joshthompson](https://github.com/joshthompson)! - What freediver needs to run on ScoopJS, all off by default, so a game that doesn't ask for them draws exactly as before:
  
  - `SceneOptions.cameraLayer`: the camera moves one layer, rather than every sprite.
  - `SceneOptions.standbyFrames`: a sprite keeps every image it switches between painted, so switching doesn't flash blank.
  - `SceneOptions.frameClock: 'display'`: sprites step through their frames on the screen's refresh, timed to the millisecond, rather than on the tick.
  - `Canvas`'s `underDialog`: drawn over the sprites, under the `dialog`.
  - `createConnectedController` takes `onMount`, as `createController` does.
  
  Also:
  
  - The camera's `y` moves sprites too. It was ignored, so a game that never sets it sees no change.
  - `blockedBySolid` leaves a move with nothing in its way alone. It used to cut every free move short by a hair, and set the position for nothing.
  - `getControllerById` is a lookup rather than a search, and `addController` adds several controllers in one go.
