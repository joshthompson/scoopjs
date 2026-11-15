# DOM Renderer

The **DOM Renderer** draws each Sprite as page elements of its own, styled
by CSS. Anything CSS and HTML can do works inside it.

```tsx
import { DomRenderer, type Scene } from 'scoopjs'

export const Game = (props: { scene: Scene }) => (
	<DomRenderer scene={props.scene} style={{ background: '#9cd6f0' }} />
)
```

## Props

The [Canvas Renderer](/renderers/canvas-renderer) takes all of these too.

| Prop | Type | What it does |
|---|---|---|
| `scene` | `Scene` | Required. The Scene to draw. |
| `style` | `JSX.CSSProperties` | CSS for the Renderer's element, after its own. Its background is white unless set here. |
| `class` | `string` | A class for the Renderer's element. |
| `ref` | `HTMLDivElement` | The Renderer's element. |
| `underlay` | `JSX.Element` | Drawn under the Sprites. |
| `underDialog` | `JSX.Element` | Drawn over the Sprites, under the `dialog`. |
| `dialog` | `Component<{ scene }>` | A component drawn over the Sprites, given the Scene. |
| `overlay` | `JSX.Element` | Drawn over the Sprites, the dialog and the Modal. |
| `loading` | `Component<{ scene }>` | Shown over everything while the Scene is loading. |
| `runOffScreen` | `boolean` | Keeps the Scene ticking while the Renderer is off the screen. |
| `onClick`, `onMouseDown`, `onMouseUp` | `(at: Vector) => void` | Pointer handlers, given the point in the Scene's coordinates. See [Input](/guide/input#the-pointer). |

From the bottom up, the Renderer's element holds: `underlay`, the Sprites,
`underDialog`, the `dialog`, the [Modal](/guide/scenes#the-modal),
`overlay`, and the `loading` screen.

The Renderer's element is a `<div>` with `position: relative`,
`overflow: hidden`, and the Scene's `width` and `height` in pixels.
`data-game-scene` on it is the Scene's id. The Renderer runs the Scene only
while some of that element is on the screen, and destroys the Scene when
it's unmounted.

## What it puts on the page

Each Controller is one `<div>` with an inner `<div>`:

```html
<div data-controller-id="player" data-controller-type="player"
     class="..." style="position: absolute; top: ...; left: ...; ...">
  <div style="width: 100%; height: 100%; background-image: url(...); ...">
    <!-- children -->
  </div>
  <!-- its Attached Controllers' <div>s -->
</div>
```

- **The outer `<div>`** is the Sprite's box. Its `top` and `left` are its
  `x` and `y`, less the camera, and it has `width`, `height`, `rotate` (from
  `rotation`), `transform: scale(xScale, yScale)` and `transform-origin`
  (from `origin`). It has `pointer-events: none`. Then the Controller's
  `style` and `class` are added.
- **The inner `<div>`** shows the Frame, as its `background-image`. It turns
  by `inner.rotation` about `inner.origin`, and gets `inner.style` last, so
  a Controller can show its Frame some other way. `children` go inside it.
- **Attached Controllers** are nested inside their carrier's outer `<div>`,
  so they move, turn and fade with it, as CSS nests them.

`data-controller-id` and `data-controller-type` are there for a game's CSS
and tests to find a Sprite by.

## `style`

A Controller's `style` is set on its outer `<div>` after the engine's own
styles, so it wins:

- A `transform` takes the place of the engine's `scale(xScale, yScale)`,
  flips included.
- A `transform-origin` takes the place of `origin`.
- Anything else CSS has works: `clip-path`, `filter`, `mix-blend-mode`,
  `transition`, gradients.

## `class`

The `class` option and the data's `class` signal are joined and set on the
outer `<div>`. A game's own stylesheet can then style Sprites, animate them
with CSS keyframes, or reach into their `children`.

## `children`

`children` is JSX drawn inside a Sprite, over its Frame. Give it as a
function in the Controller's data:

```tsx
import { createController, createObjectSignal } from 'scoopjs'

export const sign = createController({
	init: () => {
		const text = createObjectSignal('Start', 'text')
		return {
			id: 'sign',
			type: 'sign',
			x: () => 300,
			y: () => 80,
			width: () => 120,
			height: () => 40,
			...text,
			children: () => <strong class="sign">{text.text()}</strong>,
		}
	},
})
```

The function is called by the Sprite, and again whenever a signal it reads
changes, but not when the Sprite moves. So `children` that read only
`text()` are drawn once, and again when the text changes.

A Sprite with complicated `children` is the most expensive thing the DOM
Renderer draws. A game with many of them is where the Canvas Renderer helps
most.

## `cameraLayer`

`cameraLayer: true`, a Scene option, moves one layer holding every Sprite
by the camera, rather than moving every Sprite. With a lot of Sprites
that's cheaper: a Sprite then only restyles when it moves itself, not every
time the camera does. Sprites with `parallax` still move by themselves.

The layer is a stacking context. A Sprite's `z-index` then only orders it
among the other Sprites, and can't bring it over the Renderer's `overlay`.

It's off by default. The Canvas Renderer has no use for it, and reports it
as a Canvas Issue if it's on.

## `standbyFrames`

`standbyFrames: true`, a Scene option, keeps every image a Sprite switches
between painted, invisibly, under it. Switching to one then doesn't flash
blank while a big image is decoded for the first time.

It costs one more element, and one more layer, per extra image per Sprite.
It's off by default. The Canvas Renderer has no use for it, and reports it
as a Canvas Issue if it's on.

## `skipChildren`

`skipChildren: true`, a Scene option, is for benchmarking only. With it on,
neither Renderer draws any Sprite's `children`, so the two Renderers can be
compared drawing the same Frames and nothing else. Don't ship a game with
it on.

## The deprecated `Canvas`

Until 0.3.0 the DOM Renderer was called `Canvas`, and its props
`CanvasProps`. They were renamed so that "canvas" means the `<canvas>`
element the Canvas Renderer paints on.

`Canvas` and `CanvasProps` still work, as deprecated aliases of
`DomRenderer` and `DomRendererProps`, until 1.0. To move off them, rename:

```diff
- import { Canvas } from 'scoopjs'
+ import { DomRenderer } from 'scoopjs'

- <Canvas scene={scene} />
+ <DomRenderer scene={scene} />
```

The Scene's own `scene.canvas` (its camera and size), and the `Canvas` type
it holds, keep their names.
