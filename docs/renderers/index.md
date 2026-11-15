# Choosing a Renderer

A **Renderer** is what draws a Scene on the page. ScoopJS has two:

- the **DOM Renderer**, which draws each Sprite as page elements of its
  own, styled by CSS;
- the **Canvas Renderer**, which paints every Sprite onto one `<canvas>`,
  with the game's UI still page elements over and under it.

A Scene doesn't know which one draws it. A game picks one by which it puts
on the page, with the same props, and can switch back just as easily:

```tsx
import { CanvasRenderer, DomRenderer, type Scene } from 'scoopjs'

export const Game = (props: { scene: Scene; canvas: boolean }) =>
	props.canvas ? (
		<CanvasRenderer scene={props.scene} pixelated />
	) : (
		<DomRenderer scene={props.scene} />
	)
```

Both give the same pointer coordinates, the same draw order, the same
`hitTest` and the same Pointer Pick. Controllers, their data and their
`onEnterFrame` don't change at all.

## How each draws

### The DOM Renderer

Each Sprite is a `<div>`, positioned absolutely, with its Frame as a CSS
background, and its `children` inside it. An Attached Controller's `<div>`
is nested inside its carrier's.

Each Sprite's styles read the Controller's signals, so after a Tick Solid
changes only the styles that moved. The browser then does the rest: works
out styles, lays out, paints and composites every element that changed.

Anything CSS can do works: classes, `clip-path`, gradients, CSS animations,
HTML text, even links and forms inside a Sprite.

### The Canvas Renderer

There's one `<canvas>`. On each display frame where something changed, it
clears it and paints every Controller the camera can see, in draw order,
with `drawImage`. It reads each Controller's position, size, Frame and the
parts of its `style` a canvas can reproduce.

For anything else, a Controller gets a [Draw Hook](/renderers/draw-hooks):
a function that paints its Sprite with the canvas API. Whatever's asked for
that it can't draw is reported as a [Canvas
Issue](/renderers/canvas-issues), not silently left out.

The UI layers (`underlay`, `overlay`, `underDialog`, `dialog`, the Modal
and the loading screen) are page elements under both.

## Performance

The DOM Renderer's cost grows with the number of elements on the page and
how many change each Tick. Every moving Sprite means style work, layout
and compositing for the browser, every Tick, for elements on screen and off
it.

The Canvas Renderer's cost is the painting: a `drawImage` per Controller in
view, plus whatever Draw Hooks paint. Controllers the camera can't see cost
almost nothing, and a Scene where nothing changed isn't painted at all.

In run-game, the Scoop Bus Run Club's racing game, which has a few hundred
Sprites mounted and thousands of page elements under the DOM Renderer:

- the Canvas Renderer was about **2–3× cheaper on the main thread**;
- on phones, where the DOM Renderer was sluggish, the Canvas Renderer made
  it **smooth**.

The Canvas Renderer has costs of its own:

- It repaints the whole view whenever anything changes, not just what
  moved. In a busy Scene that's every Tick.
- Draw Hooks run on every repaint, so slow ones slow everything. See
  [Keeping it fast](/renderers/draw-hooks#keeping-it-fast).
- Art drawn with `children` and CSS has to be redrawn with the canvas API,
  which is work. See [Moving to the Canvas
  Renderer](/renderers/moving-to-canvas).
- Phones limit how much canvas memory a page can have. ScoopJS keeps its own
  canvas within it, but art a game keeps in canvases of its own counts too.

## Which to choose

**The DOM Renderer** suits:

- a Scene with tens of Sprites, not hundreds;
- art drawn with HTML and CSS, through `children` and `class`;
- real elements inside Sprites: links, buttons, text a player can select;
- trying an idea out quickly.

**The Canvas Renderer** suits:

- many Sprites: hundreds mounted, or thousands of page elements under the
  DOM Renderer;
- phones;
- pixel art, with `pixelated`;
- Scenes that often stand still, since a still Scene costs nothing.

Switching is cheap, so measure. Put both behind a switch, such as a query
string, and compare frame times on the slowest device you care about.

## What each supports

| | DOM Renderer | Canvas Renderer |
|---|---|---|
| Frames and sprite sheets | Yes | Yes |
| Position, size, rotation, scale, flips, `origin` | Yes | Yes |
| `inner.rotation`, `inner.origin` | Yes | Yes |
| `parallax`, the camera | Yes | Yes |
| `style` | All of CSS | [A translated set](/renderers/canvas-renderer#what-it-draws-from-style); the rest are Canvas Issues |
| `children` | Yes | Canvas Issue: use a Draw Hook |
| `class` | Yes | Canvas Issue |
| `inner.style` | Yes | Canvas Issue |
| Draw Hooks (`draw`) | Ignored | Yes |
| `onMount` | `$ref` is the Sprite's element | Runs; `$ref` is `undefined`, and reading it is a Canvas Issue |
| Pixel art | Through CSS `image-rendering` | `pixelated` prop, or `image-rendering` in `style` |
| `cameraLayer`, `standbyFrames` | Yes | Do nothing; reported as Canvas Issues |
| Off-camera Sprites | On the page, still styled | Not painted |
| Repaints | Whatever Solid changes | Only when something changed, at most once a display frame |
| Pointer coordinates, `controllersAt`, `hitTest` | Same | Same |
| UI layers, Modal, loading screen | Page elements | Page elements |
| `scene.canvasIssues()` | Always empty | What it couldn't draw |

## Next

- [DOM Renderer](/renderers/dom-renderer): its props and what it puts on
  the page.
- [Canvas Renderer](/renderers/canvas-renderer): what it draws, at what
  size, and when.
- [Draw Hooks](/renderers/draw-hooks) and [Canvas
  Issues](/renderers/canvas-issues).
- [Moving to the Canvas Renderer](/renderers/moving-to-canvas): porting a
  game, as run-game was.
