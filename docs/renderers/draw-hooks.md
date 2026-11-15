# Draw Hooks

A **Draw Hook** is a Controller's own way of painting its Sprite under the
Canvas Renderer, for what the Canvas Renderer can't draw from its style:
clip paths, gradients, text, shapes, several images. It's the `draw` option
of `createController` and `createConnectedController`.

```ts
import { createController } from 'scoopjs'
import avatarImage from './avatar.png'

export const avatar = createController({
	frames: [avatarImage],
	init: () => ({
		id: 'avatar',
		type: 'avatar',
		x: () => 20,
		y: () => 20,
		width: () => 48,
		height: () => 48,
	}),
	// Its Frame, clipped to a circle
	draw: ({ ctx, drawDefault, $ }) => {
		ctx.beginPath()
		ctx.arc($.width() / 2, $.height() / 2, $.width() / 2, 0, Math.PI * 2)
		ctx.clip()
		drawDefault()
	},
})
```

The DOM Renderer never calls it. So a Controller can keep its `children`
for the DOM Renderer and have a Draw Hook for the Canvas Renderer, which is
how a game is [moved from one to the other](/renderers/moving-to-canvas).

## What it's given

| | |
|---|---|
| `ctx` | The canvas's 2D context, already in the Sprite's own box. |
| `drawDefault()` | Paints the current Frame into the box, as the Canvas Renderer would have. |
| `image(url)` | An image to draw, once it's loaded. |
| `$` | The Controller's data. |
| `$scene` | The Scene. |
| `$currentFrame` | The Frame on screen. |

### `ctx`

`ctx` is set up so the hook draws from (0, 0) to (`width`, `height`), the
Sprite's own box, in the Scene's pixels. Its position, rotation, flips,
scale, the camera, parallax and the screen's density are all in the
transform already. Its alpha, shadow, image smoothing and (except on
WebKit) colour filters are set from the Sprite's `style`.

Whatever the hook sets on `ctx` is undone after it, with `save()` and
`restore()` around it, so it can't leak into the next Sprite.

It may draw outside the box, but see [`drawReach`](#drawreach).

### `drawDefault()`

The hook paints the Sprite **instead of** its Frame. Call `drawDefault()` to
paint the Frame too, before your own drawing to draw over it, or after to
draw under it. It paints the Frame as the Canvas Renderer would, colour
filters and all, on WebKit too.

A Controller's [Attached Controllers](/guide/attached-controllers) are
painted after its hook, as usual, each with their own Frame or Draw Hook.

### `image(url)`

`image(url)` gives `{ image, width, height }` for an image to draw with
`ctx.drawImage`, or `undefined` until it's loaded:

```ts
import { createController } from 'scoopjs'
import shadowImage from './shadow.png'
import treeImage from './tree.png'

export const tree = createController({
	frames: [treeImage],
	init: () => ({
		id: 'tree',
		type: 'tree',
		x: () => 300,
		y: () => 200,
		width: () => 64,
		height: () => 96,
	}),
	draw: ({ ctx, drawDefault, image, $ }) => {
		const shadow = image(shadowImage)
		if (shadow) ctx.drawImage(shadow.image, 0, $.height() - 12, $.width(), 16)
		drawDefault()
	},
})
```

- It goes through the Scene's [Asset Resolver](/guide/assets#the-asset-resolver),
  as Frames do.
- Each image is loaded once, the first time it's asked for, and the canvas
  is painted again when it arrives. So draw what you have, and skip what's
  `undefined`.
- An image that can't be loaded is a Canvas Issue, `image`, with its URL.

### `$`, `$scene` and `$currentFrame`

`$` is the Controller's data, as in `onEnterFrame`. `$currentFrame` is the
Frame on screen, which is the index into its Frames.

The hook isn't given `$age`. To animate by time, keep a count in the data
and set it each Tick, so the drawing pauses with the game:

```ts
import { createController, createObjectSignal } from 'scoopjs'

export const beacon = createController({
	drawReach: 24,
	init: () => ({
		id: 'beacon',
		type: 'beacon',
		x: () => 400,
		y: () => 120,
		width: () => 16,
		height: () => 16,
		...createObjectSignal(0, 'ticks'),
	}),
	onEnterFrame: ({ $, $age }) => $.setTicks($age),
	draw: ({ ctx, $ }) => {
		// A ring growing out from the middle, once a second at 60 Ticks a second
		const t = ($.ticks() % 60) / 60
		ctx.strokeStyle = `rgba(255, 220, 80, ${1 - t})`
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.arc(8, 8, 8 + t * 24, 0, Math.PI * 2)
		ctx.stroke()
		ctx.fillStyle = '#ffdc50'
		ctx.fillRect(4, 4, 8, 8)
	},
})
```

## When it runs

The hook runs every time the canvas is painted with its Sprite in view:
after each Tick in which something moved, and after anything else that
[repaints the canvas](/renderers/canvas-renderer#when-it-repaints). It's not
run for a Controller the camera can't see.

The signals it reads aren't watched. A change it should show is painted
with the next repaint, which a running Scene has every Tick. While the
Scene is paused, change them in a Ticker or `afterEnterFrames`, which
repaint it.

## `drawReach`

The Canvas Renderer doesn't paint a Controller whose box the camera can't
see. A hook that paints well outside its box, such as a speech bubble or
steam rising, would vanish as its box leaves the screen, while what it
paints should still be showing.

`drawReach` says how far the hook paints past the box, in the Sprite's own
pixels: one number for every side, or some sides':

```ts
import type { DrawReach } from 'scoopjs'

// 24 pixels every way
const everyWay: DrawReach = 24
// Up over it, and a little either side
const overHead: DrawReach = { top: 40, left: 10, right: 10 }
```

The Controller is then painted while any of that is in view. Being in its
own pixels, it turns and flips with the Sprite: a flipped Sprite's `right`
reaches left on the screen.

`drawReach` is only for painting. What a Controller collides with is still
its box, so don't make the box bigger instead.

## Text and fonts

Draw text with `ctx.fillText`, in whatever font the page has:

```ts
import { createController, createObjectSignal } from 'scoopjs'

const FONT = '"Press Start 2P", monospace'

export const nameTag = createController({
	drawReach: { top: 20, left: 40, right: 40 },
	init: () => ({
		id: 'name-tag',
		type: 'name-tag',
		x: () => 200,
		y: () => 240,
		width: () => 32,
		height: () => 32,
		...createObjectSignal('Player 1', 'name'),
	}),
	draw: ({ ctx, drawDefault, $ }) => {
		drawDefault()
		ctx.font = `10px ${FONT}`
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillStyle = 'white'
		ctx.fillText($.name(), $.width() / 2, -4)
	},
})
```

Until a web font has loaded, the canvas draws the text in a fallback font.
The Canvas Renderer paints again when a web font finishes loading, so the
text corrects itself. A font only loads once something asks for it, so if
no text on the page uses it, ask for it yourself as the game starts:

```ts
document.fonts.load('10px "Press Start 2P"')
```

## Filters and WebKit

WebKit's canvas has no `ctx.filter`, and every browser on an iPhone is
WebKit. The Canvas Renderer recolours `drawDefault()`'s Frame itself there,
but **not what a hook draws itself**: on an iPhone, a hook's own drawing
ignores the `style`'s colour filters.

So for a game that runs on phones:

- Don't use `ctx.filter` in a hook. It does nothing on WebKit.
- Recolour art once, into a canvas of your own, with `globalCompositeOperation`
  or by working on its pixels, and keep it. Then draw that.

A white flash when something's hit, made once per image and kept:

```ts
import { type DrawImage, createController, createObjectSignal } from 'scoopjs'
import knightImage from './knight.png'

const flashes = new Map<string, HTMLCanvasElement>()

/** `loaded` as a flat white silhouette, made once for each URL. */
function flash(url: string, loaded: DrawImage) {
	let art = flashes.get(url)
	if (!art) {
		art = document.createElement('canvas')
		art.width = loaded.width
		art.height = loaded.height
		const ctx = art.getContext('2d')
		if (ctx) {
			ctx.drawImage(loaded.image, 0, 0)
			ctx.globalCompositeOperation = 'source-in'
			ctx.fillStyle = 'white'
			ctx.fillRect(0, 0, art.width, art.height)
		}
		flashes.set(url, art)
	}
	return art
}

export const knight = createController({
	frames: [knightImage],
	init: () => ({
		id: 'knight',
		type: 'knight',
		x: () => 100,
		y: () => 100,
		width: () => 32,
		height: () => 32,
		...createObjectSignal(0, 'hitTicks'),
	}),
	onEnterFrame: ({ $ }) => {
		if ($.hitTicks() > 0) $.setHitTicks($.hitTicks() - 1)
	},
	draw: ({ ctx, drawDefault, image, $ }) => {
		drawDefault()
		const loaded = image(knightImage)
		if (loaded && $.hitTicks() > 0) {
			ctx.drawImage(flash(knightImage, loaded), 0, 0, $.width(), $.height())
		}
	},
})
```

## Keeping it fast

A hook runs on every repaint, for every Controller in view: in a busy
Scene, that's every Tick, for each of them. Keep it cheap.

- **Allocate no DOM, and read no layout.** No `document.createElement`, no
  `getBoundingClientRect`, no `getImageData` on every paint.
- **Build paths once.** A `Path2D` made from an SVG path's `d` once, at the
  top of the module, can be filled every paint for almost nothing.
- **Paint art that doesn't change once, and keep it.** Paint it into a
  canvas of its own, then draw that canvas with `drawImage` each time.
- **Keep kept art small.** Phones limit how much canvas a page can have in
  all: see [phones' canvas memory](/renderers/moving-to-canvas#phones-canvas-memory).
- **Prefer a baked shadow.** A large `shadowBlur` is slow to draw each
  time; a shadow painted into kept art is free.
- **Don't use `ctx.filter`** if the game runs on iPhones. See above.

### Paths built once

```ts
import { createController } from 'scoopjs'

// A 24×24 star, from an SVG path, built once
const star = new Path2D(
	'M12 1l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L12 18.5 5.2 22.1l1.3-7.6L1 9.1 8.6 8z',
)

export const pickup = createController({
	init: () => ({
		id: 'star',
		type: 'pickup',
		x: () => 500,
		y: () => 260,
		width: () => 24,
		height: () => 24,
	}),
	draw: ({ ctx }) => {
		ctx.fillStyle = '#ffd23f'
		ctx.fill(star)
		ctx.strokeStyle = '#7a5200'
		ctx.stroke(star)
	},
})
```

### Kept art

A small helper that paints art once into a canvas of its own and keeps it,
by a key that has to say everything that changes it:

```ts
const kept = new Map<string, HTMLCanvasElement>()
let keptPixels = 0
// Let the oldest go past this: a phone has little room for canvases
const MOST_PIXELS = 16_000_000

/** Art painted once by `paint`, from (0, 0) to (width, height), and kept. */
export function cachedArt(
	key: string,
	width: number,
	height: number,
	paint: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
	const found = kept.get(key)
	if (found) {
		// Used again, so the last to be let go of
		kept.delete(key)
		kept.set(key, found)
		return found
	}
	// As sharp as the screen, up to 2 pixels to one of the Scene's
	const density = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)))
	const art = document.createElement('canvas')
	art.width = Math.max(1, Math.ceil(width * density))
	art.height = Math.max(1, Math.ceil(height * density))
	const ctx = art.getContext('2d')
	if (ctx) {
		ctx.scale(density, density)
		paint(ctx)
	}
	kept.set(key, art)
	keptPixels += art.width * art.height
	for (const [oldKey, old] of kept) {
		if (keptPixels <= MOST_PIXELS || old === art) break
		kept.delete(oldKey)
		keptPixels -= old.width * old.height
		// Gives its memory back at once, which iOS needs
		old.width = 0
		old.height = 0
	}
	return art
}
```

A Draw Hook then draws it at the Sprite's size:

```ts
import { createController } from 'scoopjs'
import { cachedArt } from './cachedArt'

export const sign = createController({
	init: () => ({
		id: 'sign',
		type: 'sign',
		x: () => 120,
		y: () => 300,
		width: () => 96,
		height: () => 48,
	}),
	draw: ({ ctx, $ }) => {
		const width = $.width()
		const height = $.height()
		const paint = (art: CanvasRenderingContext2D) => {
			const wood = art.createLinearGradient(0, 0, 0, height)
			wood.addColorStop(0, '#b07a3b')
			wood.addColorStop(1, '#7a4e1f')
			art.fillStyle = wood
			art.beginPath()
			art.roundRect(0, 0, width, height, 8)
			art.fill()
		}
		const art = cachedArt(`sign ${width}x${height}`, width, height, paint)
		ctx.drawImage(art, 0, 0, width, height)
	},
})
```

## More examples

### A health bar over a Sprite

```ts
import { createController, createObjectSignal } from 'scoopjs'
import slimeImage from './slime.png'

export const slime = createController({
	frames: [slimeImage],
	// The bar is 8 pixels over its top
	drawReach: { top: 8 },
	init: () => ({
		id: 'slime',
		type: 'slime',
		...createObjectSignal(200, 'x'),
		y: () => 300,
		width: () => 32,
		height: () => 24,
		...createObjectSignal(1, 'health'), // 0 to 1
	}),
	draw: ({ ctx, drawDefault, $ }) => {
		drawDefault()
		ctx.fillStyle = '#400'
		ctx.fillRect(0, -8, $.width(), 4)
		ctx.fillStyle = '#e33'
		ctx.fillRect(0, -8, $.width() * $.health(), 4)
	},
})
```

### Something faded as one

`ctx.globalAlpha` fades each thing drawn on its own, so overlapping shapes
show through each other. To fade a group as one, as the page fades an
element and everything in it, paint it onto a canvas of its own first, then
draw that faded. Reuse one canvas for it, rather than making one each
time.

### Keeping `children` beside the hook

While a game still runs under both Renderers, keep the `children` for the
DOM Renderer and add the hook for the Canvas Renderer. A Controller with a
Draw Hook isn't reported for its `children`:

```tsx
import { createController, createObjectSignal } from 'scoopjs'

export const priceTag = createController({
	init: () => {
		const price = createObjectSignal(5, 'price')
		return {
			id: 'price-tag',
			type: 'price-tag',
			x: () => 240,
			y: () => 180,
			width: () => 80,
			height: () => 20,
			...price,
			// The DOM Renderer draws this...
			children: () => <span class="price">{price.price()} coins</span>,
		}
	},
	// ...and the Canvas Renderer this
	draw: ({ ctx, $ }) => {
		ctx.font = '16px sans-serif'
		ctx.textBaseline = 'top'
		ctx.fillStyle = 'white'
		ctx.fillText(`${$.price()} coins`, 0, 0)
	},
})
```
