# Scenes

A **Scene** is one running game world: its Controllers, its Tick and the
camera onto it. A game can have several, such as a menu and a level, and
puts one on the page with a [Renderer](/renderers/).

```ts
import { Scene } from 'scoopjs'

const scene = new Scene('level-1', {
	width: 960,
	height: 540,
	frameRate: 1000 / 60,
	setup: (scene) => {
		// add the level's Controllers here
	},
})
```

The first argument is the Scene's id. It's written on the Renderer's
element as `data-game-scene`, and named in [Canvas
Issues](/renderers/canvas-issues) about the Scene.

The Scene starts as soon as it's made: it runs `setup`, starts loading its
images, and starts its timer.

## Options

| Option | Type | What it does |
|---|---|---|
| `width`, `height` | `number` | The size of the view, in the Scene's pixels. The Renderer is this size on the page. |
| `x`, `y` | `number` | Where the camera starts. 0 unless given. |
| `setup` | `(scene) => void` | Runs once, as the Scene is made. Add the Controllers here. |
| `frameRate` | `number` | How long a Tick is, in milliseconds. 40 unless given. |
| `afterEnterFrames` | `({ $scene }) => void` | Runs at the end of every Tick, paused or not. |
| `images` | `string[]` | More images to preload, besides the Frames of the Controllers added in `setup`. See [Assets](/guide/assets). |
| `assetOrder` | `(string \| string[])[]` | Controller types, front to back, for the draw order. See [Draw order](/guide/sprites-and-frames#draw-order). |
| `resolveAsset` | `(url) => string` | The Asset Resolver: swaps an image URL for the one to show. See [Assets](/guide/assets#the-asset-resolver). |
| `frameClock` | `'tick' \| 'display'` | What Frames step on. `'tick'` unless given. See [below](#the-frame-clock). |
| `cameraLayer` | `boolean` | DOM Renderer only: moves one layer by the camera, not every Sprite. See [DOM Renderer](/renderers/dom-renderer#cameralayer). |
| `standbyFrames` | `boolean` | DOM Renderer only: keeps every image a Sprite switches between painted. See [DOM Renderer](/renderers/dom-renderer#standbyframes). |
| `skipChildren` | `boolean` | For benchmarking only: neither Renderer draws any Sprite's `children`. Don't ship a game with it on. |

## Ticks and the frame rate

A **Tick** is one step of a Scene: each Controller moves, then every Ticker
runs. The Scene runs one every `frameRate` milliseconds, on a timer.

`frameRate` is a length, not a rate. The default, 40, is 25 Ticks a second.
For 60 a second, give it `1000 / 60`.

On each Tick, in one Solid `batch`:

1. Unless the Scene is paused, every Controller's `onEnterFrame` runs, in
   the order they were added, each Controller's Attached Controllers straight
   after it.
2. Every Controller's Frame steps on (on the `'tick'` frame clock).
3. Every Ticker runs.
4. `afterEnterFrames` runs.

### Paused

`scene.isActive()` is false while the Scene is loading or a Modal is up.
Then Controllers don't move, `$age` doesn't count up, and Frames don't step,
but Tickers and `afterEnterFrames` still run. A Controller's `frame`, if a
game sets one, is still shown at once.

### Off the screen

A Scene only ticks while some of it is on the screen. Its Renderer watches
its own element with an `IntersectionObserver` and sets `scene.visible`.
While it's false, nothing runs at all, Tickers included, and the Scene picks
up where it left off when it's back.

A game that moves its Renderer about itself, such as one far out of view
while a camera pans, can pass `runOffScreen` to the Renderer to keep it
ticking.

## The frame clock

The `frameClock` option says what Controllers step through their Frames on.

- **`'tick'`** (the default): the Scene's Tick. A Sprite changes Frame in
  the same update as it moves. A Frame interval that isn't a whole number of
  Ticks still comes out right on average, since the time left over carries
  to the next Tick.
- **`'display'`**: the screen's refresh, through `requestAnimationFrame`,
  timed to the millisecond. Use it when Frame intervals matter more than
  being in step with movement.

Either way the Scene steps the Frames, whichever Renderer draws it. See
[Frames and animation](/guide/controllers#frames-and-animation).

## The camera: `scene.canvas`

`scene.canvas` is a signal holding the Scene's view of itself: where the
camera is, and how big the view is. Each value is a signal of its own.

```ts
const camera = scene.canvas.get()

camera.x() // where the camera is, in the Scene's pixels
camera.setX(400) // move it
camera.setY(camera.y() + 10)
camera.width() // the size of the view, which is the Renderer's size
```

Moving the camera moves every Sprite the other way on the screen. A Sprite
with `parallax` moves by less; see
[Parallax](/guide/sprites-and-frames#parallax).

To follow a player, move the camera at the end of each Tick:

```ts
import { type AnyController, Scene } from 'scoopjs'

declare const player: AnyController

const scene = new Scene('level', {
	width: 960,
	height: 540,
	afterEnterFrames: ({ $scene }) => {
		const camera = $scene.canvas.get()
		camera.setX(player.data.x() - camera.width() / 2)
	},
})
```

`scene.setWidth(width)` changes the view's width, and the Renderer's with it.
The name `canvas` is older than the Canvas Renderer: it has nothing to do
with a `<canvas>` element.

## Controllers

```ts
scene.addController(player, enemy, coin) // add several at once
scene.removeController('coin-3') // by id
scene.getControllerById('player') // the first with that id
scene.getControllersByType('coin') // every one of that type
scene.getAllControllers() // all of them
```

- `addController` skips `undefined`, so `scene.addController(maybe)` is
  safe. It works at any time, not only in `setup`.
- `removeController` removes every Controller added with that id.
- The three lookups include [Attached
  Controllers](/guide/attached-controllers), however deep. They're kept up
  to date as Controllers come and go, so they're cheap to call every Tick.
  The arrays they give back are shared: don't change them.
- `scene.controllers` is the signal of the Controllers added to the Scene
  itself, as `{ id, controller }` records, without the attached ones.
- `scene.controllersAt(point)` is the Pointer Pick. See
  [Input](/guide/input#which-controller-was-clicked).

## Loading

While a Scene loads its images it's paused, and `scene.loading.get()` is
true. `scene.loadingAssetCount` and `scene.loadingAssetTotal` count them, for
a loading screen. Pass the screen to the Renderer's `loading` prop, and it's
shown over the Scene until loading's done:

```tsx
import { DomRenderer, type Scene } from 'scoopjs'

const Loading = (props: { scene: Scene }) => (
	<p class="loading">
		Loading {props.scene.loadingAssetCount.get()} of{' '}
		{props.scene.loadingAssetTotal.get()}
	</p>
)

export const Level = (props: { scene: Scene }) => (
	<DomRenderer scene={props.scene} loading={Loading} />
)
```

What's loaded, and how to swap images, is in [Assets](/guide/assets).

## Tickers

A **Ticker** is a function run at the end of every Tick, whether the Scene
is paused or not. `scene.tickers` is a plain `Set`:

```ts
let ticks = 0
const count = () => {
	ticks++
}
scene.tickers.add(count)
// later
scene.tickers.delete(count)
```

Tickers run after every Controller has moved and every Frame has stepped,
in the same batch, so whatever they change is drawn in the same update. They
suit things that belong to the Scene rather than to one Controller, like a
clock or a [Plugin](/guide/plugins). They also run while paused, so a
Ticker that should stop with the game checks `scene.isActive()`.

## The Modal

A **Modal** is whatever's shown over a Scene. It pauses the Controllers
while it's up. Set `scene.modal` to show one, and to `undefined` to close
it:

```tsx
import type { Scene } from 'scoopjs'

export function pause(scene: Scene) {
	scene.modal.set(
		<div class="paused">
			<p>Paused</p>
			<button type="button" onClick={() => scene.modal.set(undefined)}>
				Carry on
			</button>
		</div>,
	)
}
```

It's drawn over the Sprites and the `dialog`, in the middle of the Scene,
with a shade behind it. The shade is the CSS custom property
`--scoopjs-modal-backdrop`, `rgba(0, 0, 0, 0.5)` unless you set it on the
Renderer (`transparent` for none):

```tsx
<DomRenderer
	scene={scene}
	style={{ '--scoopjs-modal-backdrop': 'transparent' }}
/>
```

The Modal is a page element under both Renderers.

## Destroying a Scene

`scene.destroy()` stops its timer and its display-refresh loop, and clears
its Tickers. A destroyed Scene can't be started again.

A Renderer destroys its Scene when it's unmounted, so the timer doesn't run
on for as long as the page is open. A game that switches between Scenes
makes a new Scene each time it shows one:

```tsx
import { DomRenderer, Scene, type SceneComponent } from 'scoopjs'

export const Level: SceneComponent = (props) => {
	const scene = new Scene('level', {
		width: 960,
		height: 540,
		setup: (scene) => {
			// add this level's Controllers
		},
	})
	return (
		<DomRenderer
			scene={scene}
			onClick={() => props.setScene('menu')}
		/>
	)
}
```

`SceneComponent` is a type for that pattern: a component given `setScene`,
to move to another, and an optional `mode`. ScoopJS doesn't switch Scenes
itself; the game decides which component to show.
