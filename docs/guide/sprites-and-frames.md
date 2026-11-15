# Sprites and Frames

A **Sprite** is how a Controller looks: its Frames, size, position and
anything drawn inside it. A **Frame** is one image a Sprite can show, or
one part of a sprite sheet. A Sprite steps through its Frames to animate.

A Controller's Sprite is made from its data, and each of its values is
worked out when it's read. So a Sprite only redoes the parts that read
whatever changed: a runner moving doesn't work out its Frames again.

## Position and size

| Data | What it does |
|---|---|
| `x`, `y` | Where its top-left corner is, in the Scene's pixels. |
| `width`, `height` | Its size, in the Scene's pixels. |
| `rotation` | Degrees, clockwise, about `origin`. |
| `origin` | `{ x, y }`, in its own pixels from its top-left corner. Its middle unless given. |
| `xScale`, `yScale` | Scales it about `origin`. `-1` flips it. |

The Frame fills the Sprite's box, so a Sprite is the size you give it,
whatever the size of its image.

## Frames

A Frame is an image URL. Anything an `<img>` can show works: a file Vite
imports, a path in `public/`, or a `data:` URL.

```ts
import { createController } from 'scoopjs'
import flag1 from './flag-1.png'
import flag2 from './flag-2.png'

export const flag = createController({
	frames: [flag1, flag2],
	init: () => ({
		id: 'flag',
		type: 'flag',
		x: () => 200,
		y: () => 40,
		width: () => 32,
		height: () => 32,
		state: () => 'play' as const,
		frameInterval: () => 250,
	}),
})
```

A plain image is stretched to the Sprite's box. An animated SVG shows only
its first frame under the Canvas Renderer.

How a Controller steps through its Frames (`state`, `frame`,
`frameInterval`, `randomStartFrame`) is in [Controllers](/guide/controllers#frames-and-animation).

### Sprite sheets

A Frame can be part of a sprite sheet, written `url#x,y,width,height`:

```ts
import sheet from './coin-sheet.png' // four 16×16 cells in a row

const frames = [0, 1, 2, 3].map((cell) => `${sheet}#${-cell * 16},0,16,16`)
```

It works as a CSS background does:

- The sheet is scaled so it's as tall as the Sprite, keeping its shape.
- `x` and `y` move the sheet, in the Sprite's pixels. So `-16,0` shows the
  part of the sheet 16 pixels in: the second cell, for a 16-pixel-tall
  Sprite.
- The sheet repeats in both directions, so an offset past its end wraps
  round to its start, and a positive offset shows the end of the sheet
  before its start.
- `width` and `height` only say it's a crop. The cell's size is the Sprite's
  size, so size the Sprite to match a cell.

Without the `#...` part, or with a `width` or `height` of 0, the whole image
is stretched to the box.

## `inner`

`inner` turns or styles the Frame alone, not the Sprite's box or the
Controller's parts:

```ts
import { createController, createObjectSignal } from 'scoopjs'
import wheelImage from './wheel.png'

export const wheel = createController({
	frames: [wheelImage],
	init: () => {
		const spin = createObjectSignal(0, 'spin')
		return {
			id: 'wheel',
			type: 'wheel',
			x: () => 40,
			y: () => 100,
			width: () => 24,
			height: () => 24,
			...spin,
			inner: { rotation: spin.spin },
		}
	},
	onEnterFrame: ({ $ }) => $.setSpin($.spin() + 12),
})
```

- `inner.rotation`: degrees, about `inner.origin`, or the middle without one.
- `inner.origin`: `{ x, y }`, in the Sprite's pixels.
- `inner.style`: CSS for the element that shows the Frame. DOM Renderer
  only: under the Canvas Renderer it's a [Canvas Issue](/renderers/canvas-issues).

## Draw order

What's drawn over what, the same under both Renderers:

1. **`z-index`**, from a Controller's `style`. Higher is on top.
2. Then **`assetOrder`**, the Scene option: a list of Controller types,
   **front to back**. A type listed earlier is drawn over those listed after
   it. A type that isn't listed is drawn over all of them.
3. Then the **order they were added**: later on top.
4. Each Controller's [Attached Controllers](/guide/attached-controllers#draw-order)
   straight after it, ordered among themselves by their own `z-index`.

```ts
import { Scene } from 'scoopjs'

const scene = new Scene('level', {
	width: 960,
	height: 540,
	// The player on top, then coins, then the ground, then the sky at the back.
	// A group in brackets is just for reading: the list is flattened.
	assetOrder: ['player', 'coin', ['ground', 'platform'], 'sky'],
})
```

A `z-index` that isn't a whole number (or `auto`) can't be read by the
Canvas Renderer, and is a Canvas Issue there.

## Parallax

`parallax` says how much the camera moves a Sprite. At 1, the default, it
moves with the Scene. Below 1 it's further away: at 0.5 it moves half as
far as the camera, and at 0 it doesn't move at all, like a sky.

```ts
import { createController } from 'scoopjs'
import hillsImage from './hills.png'

export const hills = createController({
	frames: [hillsImage],
	init: () => ({
		id: 'hills',
		type: 'hills',
		x: () => 0,
		y: () => 300,
		width: () => 2000,
		height: () => 240,
		parallax: () => 0.5,
	}),
})
```

Attached Controllers move with their carrier, so their own `parallax`
doesn't count. `hitTest` and the Pointer Pick go by where parallax leaves a
Sprite.

## `style`

A Controller's `style` is CSS for its Sprite, as a Solid `style` object:

```ts
style: () => ({ opacity: 0.5, filter: 'brightness(1.5)' })
```

- Under the DOM Renderer it's set on the Sprite's element after the
  engine's own styles, so it can override them. A `transform` in it takes the
  place of `xScale` and `yScale`, as it would on the page.
- Under the Canvas Renderer, the keys a canvas can draw are translated, and
  the rest are Canvas Issues. The full list is in [What it draws from
  style](/renderers/canvas-renderer#what-it-draws-from-style).

The `style` option is for CSS that doesn't change. The data's `style` is
added over it.

## `class` and `children`

Both are DOM Renderer only. Under the Canvas Renderer they're Canvas Issues,
and a [Draw Hook](/renderers/draw-hooks) does their work.

- `class` sets a class on the Sprite's element: the option's and the data's,
  joined.
- `children` is JSX drawn inside the Sprite, over its Frame. Given as a
  function, it's drawn again when a signal it reads changes, not when the
  Sprite moves:

```tsx
import { createController, createObjectSignal } from 'scoopjs'

export const label = createController({
	init: () => {
		const score = createObjectSignal(0, 'score')
		return {
			id: 'score',
			type: 'label',
			x: () => 16,
			y: () => 16,
			width: () => 120,
			height: () => 24,
			...score,
			children: () => <span>Score: {score.score()}</span>,
		}
	},
})
```

## Using `Sprite` without a Controller

ScoopJS also exports the `Sprite` component. Used without a Controller, it
steps through its own Frames on the Scene's frame clock. It reads the Scene
from `SceneContext`, so it only draws inside a Renderer, such as in its
`underlay` or `overlay`, and it's always a page element. Most games don't
need it: a Controller is how a Scene's things are drawn.
