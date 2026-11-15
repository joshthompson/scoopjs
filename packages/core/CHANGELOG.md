# @joshthompson/scoopjs

## 0.3.1

### Patch Changes

- [#4](https://github.com/joshthompson/scoopjs/pull/4) [`688eb0a`](https://github.com/joshthompson/scoopjs/commit/688eb0aa2de8444ff837f2bbaa7d52556bc31f4c) Thanks [@joshthompson](https://github.com/joshthompson)! - `createConnectedController` now uses every option it takes. `width` and `height` are given the base's data, as their type says, `xScale` flips the part, `solid` is kept on it, and `transformOrigin` works as a deprecated name for `origin`. Before, `width` and `height` were called without the data, and the other three were ignored.

## 0.3.0

### Minor Changes

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - Draw Hooks get `image(url)`, to draw images of their own that are loaded once and painted when they arrive, and the Canvas Renderer paints again once a web font has loaded. Canvas Issues say what called the line a Controller was created on (`calledFrom`), for a Controller made by a game's own helper.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - A Controller's `drawReach` says how far its Draw Hook paints past its Sprite's box, so the Canvas Renderer paints it while any of that is in view, rather than skipping it once its box is off camera. `createConnectedController` takes it too.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - The Canvas Renderer now draws `image-rendering` from a Controller's `style`, rather than reporting it as a Canvas Issue. `pixelated` and `crisp-edges` turn image smoothing off for that Sprite, and for its Attached Controllers unless they say otherwise, as CSS inherits it. `auto` and `smooth` leave it to the Renderer's `pixelated` prop, which still turns it off for every Sprite. Any other value is a Canvas Issue, with the value.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - The Canvas Renderer reports what it can't draw as Canvas Issues, rather than leaving it out silently.
  
  - It reports `children`, `class`, `inner.style`, every `style` key it doesn't translate, `filter` and `transform` functions outside the ones it does, a read of `$ref` in `onMount`, a Frame whose image fails to load, and the Scene's DOM-only options (`cameraLayer`, `standbyFrames`).
  - Each is reported once per Controller type and feature, the first time it's drawn, with `console.error`. The message starts with `[scoopjs:canvas]` and gives an example id, where the Controller was created, and how to fix it:
  
    ```
    [scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")
      created at src/draw/sprites.tsx:2787
      fix: clip with ctx.clip() in a Draw Hook
    ```
  - `scene.canvasIssues()` returns the same records as plain objects (the `CanvasIssue` type), so one call gives the whole list.
  - A Controller with a Draw Hook isn't reported for its `children` or the style it looks like.
  - `onMount` now runs under the Canvas Renderer too. Its `$ref` is undefined there, and only reading it is reported.
  - Nothing is painted to mark an issue.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - A second Renderer, `CanvasRenderer`, paints every Sprite onto one `<canvas>`. A game tries it by mounting it in place of `DomRenderer`, with the same props: the Scene and its Controllers don't change.
  
  - Sprites are painted in the same order the DOM Renderer draws them: `assetOrder`, then the order they were added, with Attached Controllers straight after their carrier, and `z-index` sorting within each.
  - Plain Frames are stretched to the Sprite, and `url#x,y,w,h` sprite sheets are cropped as the DOM Renderer crops them, offsets wrapping round the sheet. Images go through the Scene's `resolveAsset`.
  - It repaints at most once a display frame, and only after a Tick, a Ticker, the camera moving, a resize or an image loading. Sprites outside the view aren't painted.
  - The canvas is drawn at the screen's pixel density. The new `pixelated` prop turns smoothing off, for pixel art.
  - The underlay, overlay, dialogs, Modal and loading screen stay page elements, and the pointer handlers give the same scene coordinates as the DOM Renderer's.
  
  A Sprite's `style`, `children` and `class` aren't drawn yet.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - Fixes from reviewing the Canvas Renderer:
  
  - Attached Controllers more than one level deep, such as a hand on an arm on a runner, are now found by `getAllControllers`, `getControllerById` and `getControllersByType`. Under the Canvas Renderer their `onMount` runs, and their Frames stepping repaints the canvas.
  - A still Scene no longer repaints every Tick. A paused Tick repaints only if the game runs something of its own in it, its own Tickers or `afterEnterFrames`, or if the Controllers moved in the Tick before.
  - A value the Canvas Renderer can't read in a key it translates, such as `opacity: var(--o)` or `translate: 1em 2em`, is now a Canvas Issue, named with its value: `style.opacity var(--o)`.
  - An image that fails to load is reported once per Controller type, as the feature `image`, with the failing URL in the new `url` field and on the console.
  - `AnyController`, a Controller of any shape, is exported.
  - On WebKit, a Draw Hook's own drawing isn't tinted by colour filters, only `drawDefault()` is. That's now documented.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - The Canvas Renderer now draws the parts of a Controller's `style` a canvas can reproduce, with no new props to learn:
  
  - `opacity`, multiplied through carriers, as nested elements fade together on the page.
  - `visibility: hidden`, which Attached Controllers inherit unless they say `visible`, and `display: none`, which hides everything a Controller carries.
  - `z-index`, `transform` (`translate`, `scale`, `rotate` and `skew`), `translate` and `transform-origin`, as before.
  - `filter` with `hue-rotate`, `brightness`, `sepia` and `saturate`, a carrier's filter applying to its parts too. Where the canvas has no `filter` of its own, as on WebKit and so every iPhone, each image is recoloured once for each filter value, rounded to a whole degree for hue and 0.01 for the rest, and the copies kept, so an animated filter stays smooth.
  - `filter: drop-shadow(...)`, through the canvas's own shadow, turned and scaled with the Sprite. A canvas casts one shadow, so only the first is drawn.
  
  `scene.controllersAt(point)` now leaves out Controllers hidden by `visibility` or `display: none`, under either Renderer.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - `Canvas` is now `DomRenderer`, and `CanvasProps` is `DomRendererProps`. It draws exactly as before, and "canvas" is left free for the `<canvas>` element the Canvas Renderer will paint on.
  
  `Canvas` and `CanvasProps` still work, as deprecated aliases, until 1.0. The scene's own `canvas` (its camera and size) and the `Canvas` type it holds keep their names.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - A Controller can paint its own Sprite under the Canvas Renderer with a Draw Hook: a `draw` option on `createController`, for clip paths, gradients, text and shapes the Canvas Renderer can't get from style.
  
  - It's called with `ctx`, already moved into the Sprite's own box, so it draws from (0, 0) to (width, height). It's also given `drawDefault()`, which paints the current Frame there, so it can draw over or under it, and `$`, `$scene` and `$currentFrame`.
  - Whatever it sets on the context is undone after it.
  - Attached Controllers are still painted after it.
  - The DOM Renderer ignores it, so one Controller can keep its `children` for the DOM and use `draw` for canvas.
  
  A Controller made with one has a `draw` of its own, and one made without has none.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - `hitTest` now compares where two Controllers are drawn, rather than their raw `x`, `y`, `width` and `height`. That takes in Attached Controllers composed through every carrier, rotation, scale, flips, `origin`, a style's `transform`, `translate` and `transform-origin`, parallax and the camera, so collisions match what the player sees.
  
  New: `scene.controllersAt(point)` gives the Controllers drawn under a point, topmost first, in the DOM Renderer's order (`assetOrder`, then the order they were added, Attached Controllers straight after their carrier, and `z-index`). `point` is in the coordinates the Renderer's `onClick`, `onMouseDown` and `onMouseUp` give.
  
  New: `controller.carrier()` is the Controller it's attached to, if any.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - Frames now step inside the Controller, not the DOM Sprite. The Scene steps every Controller's Frames once a Tick (or on its own display refresh with `frameClock: 'display'`), and carriers step their Attached Controllers. `$currentFrame` is now exactly the Frame on screen, rather than a Tick behind, and a Controller's Frame can be read with `controller.currentFrame()`. `frameInterval`, `randomStartFrame`, a controlled `frame` and play/pause `state` behave as before, and animation still pauses under a Modal and while loading. The exported `Sprite` still steps its own Frames when it's used without a Controller.

### Patch Changes

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - The Canvas Renderer draws `grayscale()` in a Sprite's `filter`, in WebKit too, where it was a Canvas Issue.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - The Canvas Renderer now paints at its size on the screen: the Renderer's size, times any CSS transform scaling it or anything it's in, times `devicePixelRatio`. A stage scaled to fit the window, or zoomed with `transform: scale(...)`, is no longer stretched by the browser, so sprites and pixel art stay as sharp as under the DOM Renderer. Frames and Draw Hooks still paint in the scene's pixels, and drop-shadows keep their size. A zoom animated with `scale()` only resizes the canvas when it's a fifth bigger or smaller on the screen, or once it's stopped. The canvas is never more than 16 million pixels, under iOS's limit for one canvas. Under `pixelated`, a sprite that isn't rotated or skewed is painted from a whole pixel of the screen, so its edges aren't blended.
  
  A `drop-shadow`'s blur is now as wide on the canvas as on the page. It was half as wide: a canvas blurs by half its `shadowBlur`, where `drop-shadow` blurs by all of its length.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - `createConnectedController` takes a `draw` option, its Draw Hook, as `createController` does.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - Jump to a Sprite's `frame` again when a game sets it after leaving it unset. A runner standing on Frame 0, then running with no `frame`, then set back to Frame 0 stayed on a running Frame instead, and with fewer Frames by then, showed none.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - A Renderer's `onClick`, `onMouseDown` and `onMouseUp` give the right scene coordinates when the Renderer is scaled with CSS, and a touch that ends gives where it ended.

- [#2](https://github.com/joshthompson/scoopjs/pull/2) [`9271218`](https://github.com/joshthompson/scoopjs/commit/9271218bafdbfa58b047b473fec6e99191ef3d3b) Thanks [@joshthompson](https://github.com/joshthompson)! - Adds `skipChildren`, a Scene option for benchmarking only. With it on, neither Renderer draws any Sprite's `children`, so the DOM Renderer and the Canvas Renderer can be compared drawing the same Frames and nothing else.

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
