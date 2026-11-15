# Moving a game to the Canvas Renderer

A game written for the DOM Renderer can move to the Canvas Renderer a
Controller at a time, while it keeps working under the DOM Renderer the
whole way. This is how run-game, the Scoop Bus Run Club's racing game, was
moved: it had about 65 kinds of Controller drawn with `children` (inline
SVG, HTML text, CSS animations, `clip-path`, `mix-blend-mode`), and is now
painted entirely on the canvas, smoothly, on phones.

The idea is simple: keep the `children` beside a Draw Hook while porting,
compare the two Renderers as you go, let Canvas Issues tell you what's
left, then delete the DOM path.

## 1. Make the Renderer a switch

Both Renderers take the same props, so the game can choose one at run
time. A query string is easy to flip on a phone:

```tsx
import { CanvasRenderer, DomRenderer, type Scene } from 'scoopjs'

/** `?renderer=canvas` in the address picks the Canvas Renderer. */
export const canvas =
	new URLSearchParams(location.search).get('renderer') === 'canvas'

export const Race = (props: { scene: Scene }) =>
	canvas ? (
		<CanvasRenderer scene={props.scene} pixelated />
	) : (
		<DomRenderer scene={props.scene} />
	)
```

Under the DOM Renderer, the game must look and behave exactly as before,
the whole time. That's what makes it safe to port bit by bit, and to ship
in between.

Turn the Scene's `cameraLayer` and `standbyFrames` off under the Canvas
Renderer: they do nothing there, and are reported if they're on.

## 2. Find what's left

- **In the game.** Play under `?renderer=canvas`, then run
  `scene.canvasIssues()` in the console. Each issue names the Controller's
  type and id, what it asks for, and where it was made. The same are logged
  as `[scoopjs:canvas]` errors. See [Canvas Issues](/renderers/canvas-issues).
- **Once per type and feature.** If one kind of thing is reported for
  `children`, another of the same type won't be until the first is fixed.
  Fix, play again, look again.
- **In the code.** Every `children` with no `draw` beside it is a
  Controller to port. Searching for them finds the ones you haven't reached
  in play yet.
- **Page layers.** Under the Canvas Renderer, the Scene holds only the
  canvas. Anything a game drew into its Scene with page elements behind or
  between its Sprites, such as a backdrop or a fog, has to become a
  Controller of its own, with a Draw Hook, placed with `assetOrder`.
  Menus and a HUD over everything can stay in the `overlay`.

## 3. Port a Controller

Add a `draw` beside the `children`, and leave the `children` as they are:

```tsx
import { createController } from 'scoopjs'
import ventImage from './vent.png'

export function createVent(id: string, x: number) {
	return createController({
		init: () => ({
			id,
			type: 'vent',
			x: () => x,
			y: () => 400,
			width: () => 48,
			height: () => 24,
			// Still drawn by the DOM Renderer...
			children: () => <img src={ventImage} alt="" />,
		}),
		// ...and this by the Canvas Renderer
		draw: ({ ctx, image }) => {
			const vent = image(ventImage)
			if (vent) ctx.drawImage(vent.image, 0, 0, 48, 24)
		},
	})
}
```

A Controller with a Draw Hook isn't reported for its `children` or its
untranslated `style`, so the DOM path can stay put untouched.

Turning DOM art into canvas drawing:

| Under the DOM Renderer | Under the Canvas Renderer |
|---|---|
| `<img>` | `image(url)` and `ctx.drawImage`. |
| An SVG that doesn't change | An image: render it once to a `data:` URL, then `image(url)`. CSS animations inside it won't play. |
| An SVG `<path d="...">` | `new Path2D(d)`, built once, filled each paint. |
| Positioned `<div>`s | `ctx.fillRect`. |
| `linear-gradient(...)` | `ctx.createLinearGradient`. |
| `clip-path` | `ctx.clip()`. |
| `border-radius` | `ctx.roundRect` and `ctx.clip()`. |
| `mix-blend-mode` | `ctx.globalCompositeOperation`. |
| HTML text | `ctx.fillText`, laid out by hand: `measureText` to wrap it. |
| A CSS `filter` on art | Recolour once into a kept canvas (not `ctx.filter`, which WebKit lacks). See [Filters and WebKit](/renderers/draw-hooks#filters-and-webkit). |
| A CSS animation or `transition` | A value worked out from the Ticks: a count in the data, or `$age`. It then pauses with the game too. |
| `opacity` on a group | Paint the group to a canvas of its own, then draw that faded. |
| `$ref` and the element | The Controller's data, and a Draw Hook. |

Art that's the same every paint goes into a kept canvas: see [Kept
art](/renderers/draw-hooks#kept-art).

## 4. Compare the two

After each Controller, take a screenshot of the same moment under both
Renderers, such as the start of a level before anyone moves, and compare
them. The piece you ported should look the same, and nothing else should
change.

Things to look out for:

- **The edges of the screen.** The Canvas Renderer skips a Controller whose
  box is out of view. Art that reaches past its box vanishes too early: give
  it a [`drawReach`](/renderers/draw-hooks#drawreach). Don't make the box
  bigger instead: it's also what the Controller collides with.
- **Draw order.** The canvas paints in the same order the DOM Renderer
  stacks, by `z-index`, `assetOrder` and the order things were added. But a
  piece that was a page element outside the Scene, and is now a
  Controller, needs a place in `assetOrder`.
- **Frames.** A Controller that swaps its `frames` for a shorter list must
  set a `frame` that's in the new list.
- **Safari.** Check colour filters there too: see [WebKit and colour
  filters](/renderers/canvas-renderer#webkit-and-colour-filters).

## 5. Check it's all done

The game is ported when, under `?renderer=canvas`:

1. A full play-through of every level gives an empty `scene.canvasIssues()`,
   and no exceptions in the console.
2. Everything looks as it does under the DOM Renderer, near the screen's
   edges too, in Chrome and Safari.
3. It's measured on a phone. Add a frame-time meter to the page, and
   compare `?renderer=canvas` with `?renderer=dom` on the slowest phone you
   care about.

## 6. Delete the DOM path

Once every level is ported, delete what only the DOM Renderer used: the
`children`, `class` and DOM-only `style`, the switch, and `DomRenderer`
itself. What's left is one way of drawing each thing.

## Phones' canvas memory

Phones are usually why a game moves to the canvas, and they're strict about
canvas memory. iOS allows about 16 million pixels in any one canvas, and a
few hundred megabytes across all of a page's canvases. A canvas over the
limit paints nothing at all.

- **ScoopJS's own canvas** is kept under 16 million pixels: a Renderer that
  would need more is painted a little soft instead. See [Its size on the
  screen](/renderers/canvas-renderer#its-size-on-the-screen).
- **Never paint a whole level into one canvas.** A level tens of thousands
  of pixels wide is far over the limit. Paint long art in tiles, each a
  Controller of its own, or paint its paths every time.
- **Keep kept art small**, and budget it: let the oldest go past a total, as
  the [`cachedArt`](/renderers/draw-hooks#kept-art) example does.
- **Free a canvas you're done with** by setting its `width` and `height` to
  0. iOS gives the memory back straight away then, rather than when the
  canvas is garbage-collected.
- Art seen small, or zoomed out, can be kept at a lower density than the
  screen's.
