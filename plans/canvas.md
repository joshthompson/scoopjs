# Canvas Renderer

An opt-in way to draw a Scene: every Sprite painted onto one `<canvas>`, rather than each Sprite being page elements styled by CSS. The aim is to find out whether that is much faster. It's an experiment first. We only carry on past the benchmark if canvas clears the bar.

Agreed on 13 November 2026. Terms are in [GLOSSARY.md](../GLOSSARY.md) (**Renderer**, **DOM Renderer**, **Canvas Renderer**, **Draw Hook**, **Canvas Issue**, **Pointer Pick**). The big decision is in [ADR 0002](../docs/adr/0002-canvas-renderer-translates-or-reports.md).

## Goal

A game uses exactly the same Scene and Controllers as now, and switches Renderer by mounting a different component:

```tsx
<DomRenderer scene={scene} />    // today's Canvas, renamed
<CanvasRenderer scene={scene} /> // new
```

The Scene doesn't know which Renderer draws it. The UI layers (`underlay`, `overlay`, `underDialog`, `dialog`, the Modal and `loading`) stay page elements around the `<canvas>`.

## Success bar

**At least 2× better frame time on Josh's phone in run-game**, compared with the DOM Renderer. Below that, canvas mode isn't worth what it costs games to port to it.

## What the games use

From a survey of run-game, the website header and freediver on 13 November 2026:

- **run-game** draws most of its course through `children`: about 65 Controllers containing inline SVG with `clipPath`, HTML text, CSS keyframes, `clip-path` and `mix-blend-mode`. Their children re-run every Tick. It ticks at 60 Hz, uses `cameraLayer` and `assetOrder`, and sets `image-rendering: pixelated` on everything. It has about 150–400 sprites mounted and 20–50 in view.
- **The header** uses `$ref` with `getBoundingClientRect` for bats, a real `<a>` with hover inside a furby, HTML name labels, `inner.style` filters, and classes driven by document CSS variables.
- **freediver** has a DOM-based `hitTest` wrapper, as it needs parallax and nested rotation right. It uses `parallax`, `standbyFrames`, `frameClock: 'display'`, filters rebuilt every Tick, and gradient and border styles. Its `plans/optimisations.md` lists the style-recalculation costs canvas should remove.
- **All three** use opacity, visibility, colour filters, `rotation`, `origin`, flips, Attached Controllers, sprite-sheet Frames and data-URL Frames.

## Phase 1: Groundwork (DOM Renderer only)

Worth doing whatever the benchmark shows. Each step ships on its own.

### 1.1 Frame stepping moves into the Controller

The current Frame, `randomStartFrame`, `frameInterval`, `state` (play or pause), and both frame clocks (`'tick'` and `'display'`) move out of the DOM `Sprite` component and into the Controller. Both Renderers read `currentFrame` from there.

- `$currentFrame` becomes the real value. Today it's a copy sent back by an effect, and it can be a Tick behind.
- The Scene steps its Controllers' Frames in one loop, rather than each mounted Sprite registering a Ticker. Attached Controllers are stepped by their carriers.
- The `'display'` clock's `requestAnimationFrame` loop belongs to the Scene.
- The exported `Sprite` keeps a fallback for use without a Controller. No game uses it that way.
- With no Renderer mounted, Frames now advance. No game depends on them stopping.

**Done when:** Vitest covers frame stepping without a page (intervals that aren't a whole number of Ticks, `randomStartFrame`, pause, a controlled `frame`). run-game, the header and freediver animate the same as before.

### 1.2 Drawn-box geometry

One function that gives a Controller's **drawn box**: the axis-aligned box around where it appears. That means its own position, size, scale, rotation and origin, composed through each carrier for Attached Controllers, with parallax applied.

- `controller.hitTest(other)` compares drawn boxes. At the moment it compares raw `x/y/width/height`, which is wrong for attached parts (their x/y are relative to the carrier) and for parallaxed sprites.
- `scene.controllersAt(point)` returns the Controllers whose drawn boxes contain a point on the screen, topmost first. That is the whole of Pointer Pick for now. A per-Controller click API waits until a game asks for one.

**Done when:** tests cover nested rotation, flips, parallax and the camera, and freediver can delete its DOM `hitTest` wrapper and still collide the same way.

### 1.3 Rename `Canvas` to `DomRenderer`

`Canvas` stays as a deprecated alias through 0.x. The DOM-only Scene options, `cameraLayer` and `standbyFrames`, eventually move onto `DomRenderer` as props.

## Phase 2: The Canvas Renderer

It lives in Core and is exported next to `DomRenderer`.

### Painting

- A full repaint on `requestAnimationFrame`, only if something changed since the last one: a Tick, a Ticker, the camera, a resize, or an image finishing loading. Drawing only the areas that changed waits until the benchmark asks for it.
- Sprites whose drawn box is outside the view are skipped.
- The `<canvas>` backing store is its size on the screen times `devicePixelRatio`: the Renderer's size times the scale of any CSS transforms on it or around it. CSS transforms on the element, like run-game's zoom, keep working, and stay sharp.
- A `pixelated` prop turns image smoothing off for the whole Renderer. A Sprite's `image-rendering` turns it off for that Sprite and the parts it carries (see [Style](#style)).

### Draw order

The same as the DOM Renderer, so switching doesn't reshuffle a game's layers:

1. by `assetOrder`
2. then in the order Controllers were added
3. each Attached Controller straight after its carrier, inside the carrier's transform, in the order they were attached
4. `z-index` sorts within that, among top-level sprites and among a carrier's attached parts

### Frames

Frames must come out the same as today's CSS backgrounds:

- Plain images, data URLs (generated PNGs and SVGs) and SVG files. An animated SVG only shows its first frame.
- The sprite-sheet syntax `url#x,y,w,h`:
  - The offset is in display pixels.
  - When `w` and `h` are set, the sheet is scaled to the sprite's height (`background-size: auto 100%`). Otherwise the image is stretched to the sprite's box.
  - Offsets wrap round the scaled sheet, as `background-repeat` does. `generateFrames` uses positive offsets and depends on this.
  - Negative offsets work, as freediver's `generateSheetFrames` uses them.
- `resolveAsset` applies, as it does under the DOM Renderer.

### Style

The Canvas Renderer honours the `style` keys it can reproduce, and reports the rest (see [Canvas Issues](#canvas-issues)).

| Translated | How |
|---|---|
| `opacity` | `globalAlpha`, multiplied through carriers |
| `visibility: hidden`, `display: none` | not painted (attached parts are hidden too for `display: none`) |
| `z-index` | draw order, as above |
| `transform` with `translate`, `scale`, `rotate`, `skew` | canvas transforms, after the engine's own scale and rotation, as CSS would apply them |
| `translate`, `transform-origin` | likewise |
| `filter` with `hue-rotate`, `brightness`, `sepia`, `saturate`, `drop-shadow` | see below |
| `image-rendering: pixelated`, `crisp-edges`, `auto`, `smooth` | `imageSmoothingEnabled` off for `pixelated` and `crisp-edges`, inherited through carriers; `auto` and `smooth` leave it to the `pixelated` prop |

**Filters.**
- Where the browser supports `ctx.filter`, it's used.
- Elsewhere (WebKit, so every iPhone browser), each Frame is recoloured once per filter value and cached. Values are rounded (hue to a whole degree, the others to 0.01), so animated filters don't fill the cache.
- `drop-shadow` always uses the canvas's own shadow settings (`shadowColor`, `shadowBlur`, `shadowOffsetX/Y`). Every browser supports them, so freediver's per-Tick glows never touch the cache.

### Draw Hook

A new `draw` option on a Controller, for whatever the Canvas Renderer can't draw from its style:

```ts
createController({
	// ...
	draw({ ctx, drawDefault, $, $scene, $currentFrame }) {
		// ctx is already in the sprite's own box, from (0, 0) to (width, height),
		// with its position, rotation, scale and opacity applied
		drawDefault() // paints the current Frame
		// ...the Controller's own painting
	},
})
```

- Attached Controllers are painted after it by the Renderer, as usual.
- The DOM Renderer ignores it.
- A Controller with a Draw Hook has taken over its own drawing, so its `children` and untranslatable `style` aren't reported as Canvas Issues. A ported Controller can keep `children` for the DOM Renderer and use `draw` for the Canvas Renderer.

### Canvas Issues

Anything the Canvas Renderer can't draw draws nothing, and is reported:

- `children`
- `class`
- `inner.style`
- reading `$ref` in `onMount`. `$ref` is a getter that records being read, so an `onMount` that doesn't touch it isn't reported.
- any other `style` key: `transition`, `animation`, `clip-path`, `border-radius`, `box-shadow`, `background*`, `mix-blend-mode`, CSS custom properties, and `filter` functions outside the list above
- DOM-only Scene options (`cameraLayer`, `standbyFrames`)

Each is reported **once per Controller type and feature** with `console.error`, the first time it's drawn, in a form an agent can work through:

```
[scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")
  created at src/draw/sprites.tsx:2787
  fix: draw it in a Draw Hook
```

- "created at" comes from a stack captured when `createController` runs, which gives real file paths under Vite in development.
- The fix line names the alternative where there is one, e.g. "draw it in a Draw Hook".
- `scene.canvasIssues()` returns the same list as JSON, so one console call gives an agent the whole report.
- There are no visual markers on the canvas.
- Since `style` can change during play, finding every issue means playing through the levels.

### Input

The Renderer's `onClick`, `onMouseDown` and `onMouseUp` give scene coordinates, as today. `scene.controllersAt(point)` finds what was under them.

## Phase 3: Benchmark

1. **A stress page in this repo**: N moving, animated, rotated sprites, from 100 to 5,000, with frame time compared under both Renderers.
2. **run-game with `children` skipped in both Renderers**, behind a bench switch, profiled on the phone in a busy race. This answers whether canvas draws sprites faster at all, without canvas winning just by drawing less.
3. **One busy run-game course ported** to Frames and Draw Hooks, working through its Canvas Issues, then measured again with real art.

If the 2× bar is met, the next step is porting the rest of run-game. If it isn't, Phase 1 still stands on its own, and the Canvas Renderer stays unexported or is removed.

## Not doing

- Emulating the DOM under canvas: a page-element layer for `children`, or rasterising `children` through SVG `foreignObject` (ADR 0002).
- Choosing the Renderer per Controller, or with a Scene option.
- New typed Sprite props for opacity, visibility, z-index or filters, since `style` is translated instead.
- Visual markers for unsupported features.
- A per-Controller click API.
- Drawing only the areas that changed, a WebGL renderer, or OffscreenCanvas in a worker. These can come later if the benchmark points at them.
- A renderer interface. The two Renderers are two components reading the same Scene, and nothing yet needs more than that.

## Risks

- **Children in run-game.** Most of its art is `children`, so the real answer only comes at step 3 of the benchmark, after a course has been ported.
- **WebKit filters.** The recolour cache costs memory and a pause the first time each Frame and filter pair is seen. Filters that vary a lot in value could still churn it.
- **Translated transforms** have to compose in the same order CSS applies them, or squashed and skewed sprites will be drawn slightly wrong.
