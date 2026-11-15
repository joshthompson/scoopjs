# Canvas Renderer

The **Canvas Renderer** paints every Sprite onto one `<canvas>`, with the
game's UI still page elements over and under it. It's cheaper than the DOM
Renderer with a lot of Sprites, and only repaints when something has
changed. See [Choosing a Renderer](/renderers/) for when to use it.

```tsx
import { CanvasRenderer, type Scene } from 'scoopjs'

export const Game = (props: { scene: Scene }) => (
	<CanvasRenderer scene={props.scene} pixelated />
)
```

It never imitates the DOM. It draws a Sprite's Frames and the parts of its
`style` a canvas can reproduce. For anything else there's a [Draw
Hook](/renderers/draw-hooks), and whatever's left out is reported as a
[Canvas Issue](/renderers/canvas-issues). Why it works that way is in [ADR
0002](/adr/0002-canvas-renderer-translates-or-reports).

## Props

It takes every [prop the DOM Renderer takes](/renderers/dom-renderer#props),
so a game switches by changing the component's name, and one more:

| Prop | Type | What it does |
|---|---|---|
| `pixelated` | `boolean` | Turns image smoothing off for every Sprite, so pixel art stays crisp when it's scaled, as `image-rendering: pixelated` does on the page. It also sets `image-rendering: pixelated` on the `<canvas>` itself. |

## What stays a page element

The Renderer's element is a `<div>` just like the DOM Renderer's, with the
same size, `style`, `class`, `data-game-scene` and pointer handlers. The
`<canvas>` sits where the Sprites would, so from the bottom up it holds:

1. `underlay`
2. the `<canvas>`, with every Sprite painted on it
3. `underDialog`
4. the `dialog`
5. the [Modal](/guide/scenes#the-modal)
6. `overlay`
7. the `loading` screen

Everything but the `<canvas>` is ordinary Solid on the page: menus, a HUD,
buttons. Anything that has to sit between two Sprites has to be a
Controller, since the canvas is one layer.

## Frames

- A plain image is stretched to the Sprite's box, as the DOM Renderer's CSS
  background is.
- A sprite-sheet Frame, `url#x,y,w,h`, is cropped just as the DOM Renderer
  crops it: the sheet scaled to the Sprite's height, moved by `x` and `y`,
  and repeating so offsets wrap round it. See [Sprite
  sheets](/guide/sprites-and-frames#sprite-sheets).
- `inner.rotation` turns the Frame only, about `inner.origin` or the
  middle.
- Every URL goes through the Scene's [Asset Resolver](/guide/assets#the-asset-resolver).
- An animated SVG shows only its first frame.
- An image is loaded the first time it's shown. A Sprite whose image hasn't
  loaded yet paints nothing, and is painted once it has.

## What it draws from `style`

These keys of a Controller's `style` are translated into canvas drawing.
Every other key is a Canvas Issue, as is a value it can't read, such as
`opacity: var(--o)` or `translate: 1em`; a key with a value it can't read is
drawn as if it weren't there.

| Key | What it does on the canvas |
|---|---|
| `opacity` | Fades the Sprite. A number or a percentage. Multiplied through carriers, as nested elements fade together. |
| `visibility` | `hidden` isn't painted. Attached Controllers inherit it, unless they say `visible`. |
| `display` | `none` isn't painted, nor is anything it carries. |
| `z-index` | A whole number, or `auto`. Orders it among the top-level Sprites, or among its carrier's parts. See [Draw order](#draw-order). |
| `transform` | The `translate`, `translateX`, `translateY`, `scale`, `scaleX`, `scaleY`, `rotate`, `skew`, `skewX` and `skewY` functions, applied as CSS applies them. Lengths in `px` or `%`; angles in `deg`, `rad`, `grad` or `turn`. It takes the place of `xScale` and `yScale`, as on the page. |
| `translate` | One or two lengths, in `px` or `%`, moving it on the screen, outside its rotation. |
| `transform-origin` | One or two of lengths in `px` or `%`, and `left`, `center`, `right`, `top` and `bottom`. It takes the place of `origin`. |
| `filter` | The colour functions `hue-rotate`, `brightness`, `sepia`, `saturate` and `grayscale`, and one `drop-shadow`. See below. |
| `image-rendering` | `pixelated` and `crisp-edges` turn image smoothing off for this Sprite. `auto` and `smooth` leave it to the Renderer's `pixelated` prop. |

### `filter`

- **Colour functions**: `hue-rotate` (an angle), and `brightness`, `sepia`,
  `saturate` and `grayscale` (a number or a percentage). They're applied in
  order, then each carrier's after them, as the page filters an element and
  then the elements around it.
- **`drop-shadow`**: an offset, a blur if you like, and a colour if you like,
  with lengths in `px`. Without a colour it's black. A canvas casts one
  shadow, so only the first `drop-shadow` is drawn, and any after it is a
  Canvas Issue. A carrier's shadow is cast by its parts too, unless they
  have their own. The shadow is turned and scaled with the Sprite, and its
  blur is as wide as on the page.
- Any other function (`blur()`, `contrast()`, `invert()`, `opacity()`, an
  SVG `url()`), or one whose arguments it can't read, is a Canvas Issue.
  For `opacity()`, use the `opacity` key instead.

### `image-rendering`

`pixelated` and `crisp-edges` turn image smoothing off for the Sprite, and
for its Attached Controllers unless they say otherwise, as CSS inherits it.
The Renderer's `pixelated` prop turns it off for every Sprite, whatever they
say.

A Draw Hook paints with the same smoothing as its Sprite, so images it
draws itself stay crisp too.

### `transform`

A `transform` works in the Sprite's own box, about its `transform-origin`
(or `origin`, or its middle), and is combined with its `rotation` as CSS
combines `transform` with the `rotate` property. It takes the place of
`xScale` and `yScale`, as it does on the page. `matrix()`,
the 3D functions and `perspective()` are Canvas Issues: a canvas is flat.

### WebKit and colour filters

WebKit's canvas has no `filter`, and every browser on an iPhone is WebKit.
There, the Canvas Renderer recolours each image itself instead:

- Each image is recoloured into a copy once for each filter value, and the
  copy is kept.
- Values are rounded, hue to a whole degree and the rest to 0.01, so an
  animated filter makes a copy for each rounded value it passes through, not
  one a Tick. The 256 most recently used copies are kept.
- An image from another site, without CORS allowing it, can't be read, and
  is drawn without its colour filter.
- **A Draw Hook's own drawing isn't recoloured on WebKit**: only what its
  `drawDefault()` paints. See [Draw Hooks](/renderers/draw-hooks#filters-and-webkit).

`drop-shadow` uses the canvas's own shadow everywhere, WebKit included.

## Its size on the screen

The canvas is painted at its size on the screen, in the screen's own pixels:
the Renderer's size, times any CSS transform scaling it or anything it's in,
times `devicePixelRatio`. So a game can scale its stage to fit the window,
or zoom with `transform: scale(...)`, and its Sprites stay as sharp as under
the DOM Renderer. Frames and Draw Hooks still paint in the Scene's pixels;
the Renderer scales them.

```tsx
import { CanvasRenderer, type Scene } from 'scoopjs'

// A 960×540 stage, scaled to fill the window's width
export const Stage = (props: { scene: Scene }) => (
	<div
		style={{
			transform: `scale(${window.innerWidth / 960})`,
			'transform-origin': '0 0',
		}}
	>
		<CanvasRenderer scene={props.scene} />
	</div>
)
```

- It's measured each time it's painted. It's painted again when the window
  resizes, the screen's density changes, the `style` or `class` of anything
  the Renderer is in changes, or a CSS transition or animation on one of
  them finishes.
- A zoom animated with `scale()` doesn't reallocate the canvas every frame.
  It's resized at once when it's a fifth bigger or smaller on the screen
  than it's painted, and otherwise once its size has stayed put for a
  quarter of a second. Till then, the browser stretches it a little.
- It's never more than 16 million pixels, under the most an iPhone allows
  one canvas, nor more than 16,384 pixels on a side. A Renderer that would
  need more is painted at a lower density, a little soft.
- Under a `pixelated` Renderer, or for a Sprite that's `pixelated` itself,
  a Sprite that isn't rotated or skewed is painted from a whole pixel of
  the screen, so the edges of pixel art aren't blended with what's behind
  them.
- A rotated Renderer is painted at the size of the box around it on the
  screen, which is more pixels than it needs.

### Pointer coordinates under a CSS scale

The pointer handlers divide out any CSS scale, so `onClick` and the rest
give the Scene's pixels however the Renderer is scaled. A click in the
middle of the 960×540 stage above is `{ x: 480, y: 270 }` (plus the
camera), at any window size. The DOM Renderer does the same.

## Draw order

Sprites are painted in the order the DOM Renderer stacks them, so switching
doesn't reshuffle a game's layers:

1. by `z-index`, among the top-level Controllers;
2. then by the Scene's `assetOrder`: types listed earlier on top, unlisted
   types over all of them;
3. then in the order they were added;
4. each Attached Controller straight after its carrier, in the order they
   were attached, ordered among themselves by `z-index` (the carrier counts
   as 0, so a part below 0 goes under it).

More in [Draw order](/guide/sprites-and-frames#draw-order).

## Culling

A Controller whose box is outside what the camera sees isn't painted, and
costs next to nothing. Each Attached Controller is checked on its own, since
it can reach past its carrier.

The box is the upright box around where the Sprite is drawn, turned, scaled
and all. A Draw Hook that paints well outside its box would vanish near the
screen's edges; its `drawReach` says how far it reaches. See
[`drawReach`](/renderers/draw-hooks#drawreach).

A Controller that's never in view is never painted, so its Canvas Issues
aren't found until it is.

## When it repaints

It repaints at most once a display frame, and only when something has
changed since the last:

- a Tick in which the Controllers moved, and the paused Tick after one;
- a paused Tick, if the game runs something of its own then: a Ticker of
  its own, or `afterEnterFrames`;
- the camera moving, between Ticks too;
- a Frame stepping, which on the `'display'` frame clock is between Ticks;
- a Controller added or removed;
- the Renderer resizing, or its size on the screen changing (see above);
- `pixelated` changing;
- an image loading;
- a web font loading, for text a Draw Hook draws in it.

A Scene where nothing changes isn't painted at all, which saves a phone's
battery.

A Draw Hook's signals aren't watched. If something a Draw Hook reads
changes while the Scene is paused, and nothing above happens, the canvas
isn't repainted. Change it in a Ticker, or in `afterEnterFrames`, and it is.

## `onMount`

A Controller's `onMount` runs once it's in the Scene, as the DOM Renderer
runs it once its Sprite is on the page. There's no element, so `$ref` is
`undefined`, and reading it is a Canvas Issue. A Controller taken out and
put back is mounted again.

## What it reports

Everything it can't draw is a [Canvas Issue](/renderers/canvas-issues),
logged once per Controller type and feature, and listed by
`scene.canvasIssues()`:

- `children`, `class` and `inner.style`;
- `style` keys and values beyond the table above;
- a read of `$ref` in `onMount`;
- an image that fails to load;
- the Scene's DOM-only options, `cameraLayer` and `standbyFrames`, if
  they're on.

Nothing is painted to mark an issue.
