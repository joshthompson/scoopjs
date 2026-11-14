# ScoopJS

A small game engine for [SolidJS](https://www.solidjs.com), where Solid
components are the game objects. A `Scene` ticks its controllers, and each
controller is drawn as a sprite that follows its own signals. The engine has no
draw loop of its own: Solid's reactivity does the drawing.

Pre-1.0: any minor version can break the API.

For now it's on GitHub Packages, as `@joshthompson/scoopjs`. Install it under
the name `scoopjs`, so imports stay the same when it moves to npm:

```ini
# .npmrc, next to your package.json
@joshthompson:registry=https://npm.pkg.github.com
```

```sh
pnpm add scoopjs@npm:@joshthompson/scoopjs solid-js
```

GitHub Packages needs a token even to install. It goes in `~/.npmrc` as
`//npm.pkg.github.com/:_authToken=…`, from a token with `read:packages`.

```tsx
import { DomRenderer, Key, Scene, createController } from 'scoopjs'
import { createSignal } from 'solid-js'
import busImage from './bus.png'

const bus = createController({
	frames: [busImage],
	init: () => {
		const [x, setX] = createSignal(0)
		return {
			id: 'bus',
			type: 'bus',
			x,
			setX,
			y: () => 100,
			width: () => 64,
			height: () => 32,
		}
	},
	onEnterFrame: ({ $ }) => {
		if (Key.isDown('ArrowRight')) $.setX?.($.x() + 2)
	},
})

const scene = new Scene('demo', {
	width: 320,
	height: 180,
	frameRate: 1000 / 60,
	setup: (scene) => scene.addController(bus),
})

export const Game = () => <DomRenderer scene={scene} />
```

## The pieces

- **`Scene`** is one running game world. It ticks every `frameRate`
  milliseconds while it's on the screen. Each tick, every controller's
  `onEnterFrame` runs, and then every ticker. All of a tick is one Solid
  `batch`.
- **`createController`** makes one thing in a scene: its data (signals) and
  what it does each tick. `createConnectedController` makes one that rides
  on another, and `attach` hangs one controller on another.
- **`DomRenderer`** draws a scene, each sprite as page elements of its own,
  not a `<canvas>`. Pass `style` to change its background, which is white by
  default. It was called `Canvas`, and that name still works until 1.0.
- **`CanvasRenderer`** draws a scene by painting every sprite onto one
  `<canvas>`, with the game's UI still page elements over and under it. It
  takes the same props as `DomRenderer`, plus `pixelated`, which turns image
  smoothing off so pixel art stays crisp when it's scaled. See
  [Choosing a Renderer](#choosing-a-renderer).
- **`Sprite`** is how a controller looks: its frames (image URLs, optionally
  `url#left,top,width,height` for part of a sprite sheet), size, scale and
  rotation.
- **`Key`** gives keyboard state as signals: `Key.isDown('ArrowLeft')`.
- **`blockBySolids`** and **`isOverlapping`** handle collisions.
  `hitTest` compares where two controllers are drawn, never the page.
- **`scene.controllersAt(point)`** is the Pointer Pick: the controllers drawn
  over a point, topmost first, leaving out any hidden by their style. `point`
  is in the coordinates the Renderer's `onClick`, `onMouseDown` and
  `onMouseUp` give, so it gives the same answer under either Renderer.

### Options a game passes in

- **`resolveAsset`** (on `Scene`) swaps every image URL for the one to
  actually show, such as a seasonal version of it.
- **`--scoopjs-modal-backdrop`** is the CSS colour behind `scene.modal`. Set it
  on your renderer (`transparent` for none).
- **`cameraLayer`** (on `Scene`, DOM Renderer only) moves one layer by the
  camera instead of every sprite, which is cheaper with a lot of sprites. A
  sprite's `z-index` then only orders it among the other sprites.
- **`standbyFrames`** (on `Scene`, DOM Renderer only) keeps every image a
  sprite switches between painted, so switching to one doesn't flash blank
  while it decodes.
- **`frameClock`** (on `Scene`) is what sprites step through their frames on:
  the scene's tick (`'tick'`, the default) or the screen's refresh
  (`'display'`), for frame intervals that aren't a whole number of ticks.
- **`underDialog`** (on either Renderer) is drawn over the sprites but under
  the `dialog`.
- **`skipChildren`** (on `Scene`) is for benchmarking only: neither Renderer
  draws any sprite's `children`, so the two can be compared drawing the same
  frames and nothing else. Don't ship a game with it on.

## Choosing a Renderer

A scene doesn't know which Renderer draws it: a game picks one by which it
puts on the page, with the same props, and can switch back just as easily.

```tsx
export const Game = () => <CanvasRenderer scene={scene} pixelated />
```

- **`DomRenderer`** draws each sprite as page elements, so anything CSS can
  do works, `children` and `class` included. It's the safe choice, and the
  one to keep for a sprite drawn mostly with `children`.
- **`CanvasRenderer`** paints them all onto one `<canvas>`, which is cheaper
  with a lot of sprites, and only repaints when something has changed: a
  still scene doesn't repaint at all. It draws a sprite's frames and the
  parts of its `style` a canvas can reproduce. For anything else there's a
  Draw Hook, and whatever's left out is reported as a Canvas Issue.

### What the Canvas Renderer draws from `style`

- `opacity`, multiplied through carriers, as nested elements fade together.
- `visibility` (inherited by attached controllers unless they say `visible`)
  and `display: none` (which hides everything a controller carries).
- `z-index`, among sprites and among a carrier's attached controllers.
- `transform` (the `translate`, `scale`, `rotate` and `skew` functions),
  `translate` and `transform-origin`, in px, % and, for the origin, keywords.
- `filter` with `hue-rotate`, `brightness`, `sepia` and `saturate`, and one
  `drop-shadow`. On WebKit, which has no canvas `filter`, each image is
  recoloured instead.
- `image-rendering`: `pixelated` and `crisp-edges` turn image smoothing off
  for that sprite, and `auto` and `smooth` leave it to the Renderer's
  `pixelated` prop, which turns it off for every sprite whatever they say.
  Attached controllers inherit it, as they do on the page, unless they say
  otherwise. It's only how the sprite is painted: while the canvas is
  stretched (see below), it's smoothed as a whole unless the Renderer is
  `pixelated`.

Anything else in `style`, a value it can't read (such as `var(--o)` or
`1em`), `class`, `inner.style` and `children` are Canvas Issues.

### Its size on the screen

The canvas is painted at its size on the screen, in the screen's own pixels:
the Renderer's size, times any CSS transform scaling it or anything it's in,
times `devicePixelRatio`. So a game can scale its stage to fit the window, or
zoom with `transform: scale(...)`, and its sprites stay as sharp as under the
DOM Renderer. Frames and Draw Hooks still paint in the scene's pixels.

- It's measured each time it's painted, and painted again when the window
  resizes, the screen's density changes, the `style` or `class` of anything
  the Renderer is in changes, or a CSS transition or animation on one of
  them finishes.
- A zoom animated with `scale()` doesn't reallocate the canvas every frame.
  It's resized at once when it's a fifth bigger or smaller on the screen than
  it's painted, and otherwise once its size has stayed put for a quarter of a
  second. Till then, the browser stretches it a little.
- It's never more than 16 million pixels, under the most an iPhone allows
  one canvas. A Renderer that would need more is painted at a lower density,
  a little soft.
- Under a `pixelated` Renderer, or for a sprite that's `pixelated` itself,
  a sprite that isn't rotated or skewed is painted from a whole pixel of the
  screen, so the edges of pixel art aren't blended with what's behind them.
- A rotated Renderer is painted at the size of the box around it on the
  screen, which is more pixels than it needs.

### The Draw Hook

A controller's `draw` option paints its sprite under the Canvas Renderer, in
place of its current frame, for clip paths, gradients, text and shapes it
can't get from style. The DOM Renderer never calls it, so a controller can
keep its `children` for the DOM and use `draw` for canvas.

```tsx
const badge = createController({
	frames: [badgeImage],
	init: () => ({ /* ... */ }),
	draw: ({ ctx, drawDefault, $ }) => {
		ctx.beginPath()
		ctx.arc($.width() / 2, $.height() / 2, $.width() / 2, 0, Math.PI * 2)
		ctx.clip()
		drawDefault()
	},
})
```

- `ctx` is already in the sprite's own box, so it draws from (0, 0) to
  (width, height), with the sprite's alpha, filter and shadow set.
- `drawDefault()` paints the current frame there, so the hook can draw over
  or under it. `$`, `$scene` and `$currentFrame` are there too.
- `image(url)` gives an image to draw with `ctx.drawImage`, through the
  scene's `resolveAsset`: undefined till it's loaded, when the sprite is
  painted again. Text drawn in a web font is painted again once the font's
  loaded, too.
- Whatever it sets on `ctx` is undone after it, and attached controllers
  are still painted after it.
- On WebKit the colour filters only recolour what `drawDefault()` paints, not
  what the hook draws itself.

### Canvas Issues

Whatever a controller asks for that the Canvas Renderer can't draw is a
Canvas Issue. Each is reported once per controller type and feature, the
first time it's drawn, with `console.error`, giving an example id, where the
controller was created, what called that (for a controller made by a helper
of the game's own) and how to fix it:

```
[scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")
  created at src/draw/sprites.tsx:27
  called from src/draw/course.tsx:112
  fix: clip with ctx.clip() in a Draw Hook
```

Under Vite in development, `created at` names the right file, but its line is
in the compiled file Vite serves, not your source, since Chrome doesn't map
stack traces through source maps: the type and id are the reliable way to find
it.

`scene.canvasIssues()` gives the same as plain records (`CanvasIssue`), so a
game, or an agent porting one, can read the whole list in one call. It's
empty under the DOM Renderer. Issues are only found by drawing, so finding
them all means playing through every level.

## Building with Vite

`vite-plugin-solid` picks up the package's `solid` export condition by itself,
and compiles ScoopJS against your app's own copy of Solid. If you work on
ScoopJS through `pnpm link`, add `resolve: { dedupe: ['solid-js'] }` to your
Vite config. Without it, the linked copy brings its own Solid, and signals
silently stop updating across the two.
