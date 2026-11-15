# Controllers

A **Controller** is one thing in a Scene: a player, a coin, a cloud. It's
its data, as signals, and what it does each Tick. Its
[Sprite](/guide/sprites-and-frames) is drawn from that data.

## `createController`

```ts
import { createController } from 'scoopjs'
import { createSignal } from 'solid-js'
import coinImage from './coin.png'

export function createCoin(id: string, x: number, y: number) {
	return createController({
		frames: [coinImage],
		init: () => ({
			id,
			type: 'coin',
			x: () => x,
			y: () => y,
			width: () => 16,
			height: () => 16,
		}),
	})
}
```

The options:

| Option | What it is |
|---|---|
| `init` | Required. Makes the Controller's data, once, as it's created. |
| `frames` | The Frames its Sprite shows: image URLs. See [Sprites and Frames](/guide/sprites-and-frames). |
| `onEnterFrame` | Runs every Tick the Scene isn't paused. |
| `onMount` | Runs once, as its Sprite is first drawn. |
| `style` | CSS for its Sprite that doesn't change. Data's `style` is added over it. |
| `class` | A class for its Sprite (DOM Renderer only). Data's `class` is added to it. |
| `randomStartFrame` | Starts on a random Frame rather than the first. |
| `solid` | What of it others can't move through. See [Collision](/guide/collision). |
| `blockedBySolid` | Stops it moving into solid Controllers. See [Collision](/guide/collision). |
| `draw` | Its [Draw Hook](/renderers/draw-hooks), for the Canvas Renderer. |
| `drawReach` | How far its Draw Hook paints past its box. See [Draw Hooks](/renderers/draw-hooks#drawreach). |

## Its data: `init`

`init` gives the Controller's data, which is also `controller.data`, and
`$` in its callbacks. Six things are required:

- `id`: a string. Lookups find the first Controller with an id.
- `type`: a string. Draw order, lookups and Canvas Issues go by type.
- `x`, `y`: where its top-left corner is, in the Scene's pixels, as
  signals (or any functions returning numbers).
- `width`, `height`: its size, the same way.

Everything a Sprite can show can be given as a signal too. Give only what
you need:

| Data | What it does |
|---|---|
| `setX`, `setY` | Setters for `x` and `y`. Needed for `blockedBySolid`. |
| `frames` | The Frames, as a signal. It wins over the `frames` option. |
| `frame` | A Frame to show, by index. See [below](#frames-and-animation). |
| `state` | `'play'` to animate through the Frames, `'pause'` (or nothing) to stay put. |
| `frameInterval` | How long each Frame shows, in milliseconds. 100 unless given. |
| `rotation` | In degrees, about `origin`. |
| `origin` | `{ x, y }` in its own pixels: what it turns and scales about. Its middle unless given. |
| `xScale`, `yScale` | Scale; `-1` flips it. |
| `parallax` | How much the camera moves it. See [Parallax](/guide/sprites-and-frames#parallax). |
| `style` | CSS for its Sprite, as a signal. |
| `class` | A class, as a signal (DOM Renderer only). |
| `inner` | `{ rotation, origin, style }`, each a signal: turns only its Frame. See [inner](/guide/sprites-and-frames#inner). |
| `children` | JSX drawn inside its Sprite (DOM Renderer only). |

Anything else you put in the data is yours: speed, health, a name. The
Controller is typed from `init`, so `$` knows about it.

### Signals with `createObjectSignal`

Solid's `createSignal` gives a pair. `createObjectSignal` gives the same
signal as an object, with names you choose, which spreads straight into a
Controller's data:

```ts
import { createController, createObjectSignal } from 'scoopjs'

export const ball = createController({
	init: () => ({
		id: 'ball',
		type: 'ball',
		...createObjectSignal(100, 'x'), // { x, setX }
		...createObjectSignal(50, 'y'), // { y, setY }
		...createObjectSignal(2, 'speed'), // { speed, setSpeed }
		width: () => 12,
		height: () => 12,
	}),
	onEnterFrame: ({ $ }) => $.setX($.x() + $.speed()),
})
```

Without a name it's `{ get, set }`, as the Scene's own signals are:
`scene.loading.get()`.

### Typing the data yourself

To type a Controller's data up front, for a function that makes many of
them, say, extend `ControllerBaseType`:

```ts
import { type ControllerBaseType, createController } from 'scoopjs'
import { type Accessor, type Setter, createSignal } from 'solid-js'

interface RunnerData extends ControllerBaseType {
	speed: Accessor<number>
	setSpeed: Setter<number>
}

export function createRunner(id: string) {
	return createController<RunnerData>({
		init: () => {
			const [x, setX] = createSignal(0)
			const [speed, setSpeed] = createSignal(1)
			return {
				id,
				type: 'runner',
				x,
				setX,
				y: () => 200,
				width: () => 32,
				height: () => 48,
				speed,
				setSpeed,
			}
		},
		onEnterFrame: ({ $ }) => $.setX?.($.x() + $.speed()),
	})
}
```

`AnyController` is a Controller of any shape, for code that works with all
of them.

## `onEnterFrame`

`onEnterFrame` runs every Tick, unless the Scene is paused. It's where a
Controller moves, reads input and reacts to others. It's given:

| | |
|---|---|
| `$` | The Controller's data. |
| `$scene` | The Scene. |
| `$age` | How many Ticks it has run before this one. |
| `$currentFrame` | The Frame on screen. |
| `$controller` | The Controller itself, for `hitTest` and the like. |

```ts
import { Key, createController, createObjectSignal } from 'scoopjs'

export const player = createController({
	init: () => ({
		id: 'player',
		type: 'player',
		...createObjectSignal(0, 'x'),
		...createObjectSignal(0, 'y'),
		width: () => 32,
		height: () => 32,
	}),
	onEnterFrame: ({ $, $scene, $controller }) => {
		if (Key.isDown('ArrowRight')) $.setX($.x() + 3)
		for (const coin of $scene.getControllersByType('coin')) {
			if ($controller.hitTest(coin)) $scene.removeController(coin.id)
		}
	},
})
```

Every Tick is one Solid `batch`, so setting several signals here redraws
once. After `onEnterFrame`, a Controller with `blockedBySolid` is moved back
out of anything solid, and then its Attached Controllers' `onEnterFrame`
runs.

## `onMount`

`onMount` runs once, as the Controller's Sprite is first drawn. It's given
`$`, `$scene`, `$currentFrame`, `$controller` and `$ref`.

- Under the DOM Renderer it runs when its Sprite's element is on the page,
  and `$ref` is that element.
- Under the Canvas Renderer it runs as the Controller joins the Scene.
  There's no element, so `$ref` is `undefined`, and reading it is a [Canvas
  Issue](/renderers/canvas-issues). An `onMount` that doesn't read `$ref`
  works the same under both.

A Controller taken out of the Scene and put back is mounted again.

## Frames and animation

A Controller shows one of its Frames at a time. Which one is decided by the
Controller, not the Renderer, so it's the same whichever draws it.

- It **animates** only while `state` is `'play'`. Without a `state` it stays
  on its first Frame.
- Each Frame shows for `frameInterval` milliseconds, 100 unless given. An
  infinite interval never changes Frame.
- `randomStartFrame: true` starts it on a random Frame, so a crowd of the
  same thing doesn't move in step.
- A Controller's `frame`, if its data has one, is a Frame to **jump to**. It's
  shown as soon as it's set, and while it stays the same the Controller
  plays on from it (if it's playing). Setting it to `undefined` lets go, so
  setting the same number again jumps again.
- `$currentFrame`, and `controller.currentFrame()` outside a callback, is the
  Frame on screen.
- Frames don't step while the Scene is paused, but a newly set `frame` is
  still shown.

A walking character that stands still on its first Frame:

```ts
import { createController, createObjectSignal } from 'scoopjs'
import walk1 from './walk-1.png'
import walk2 from './walk-2.png'
import walk3 from './walk-3.png'

export const walker = createController({
	frames: [walk1, walk2, walk3],
	init: () => {
		const moving = createObjectSignal(false, 'moving')
		return {
			id: 'walker',
			type: 'walker',
			...createObjectSignal(0, 'x'),
			y: () => 100,
			width: () => 24,
			height: () => 32,
			...moving,
			state: () => (moving.moving() ? 'play' : 'pause'),
			// Back to standing when it stops
			frame: () => (moving.moving() ? undefined : 0),
			frameInterval: () => 120,
		}
	},
})
```

The Scene steps every Controller's Frames once a Tick, or on the display's
refresh with `frameClock: 'display'`. Carriers step their Attached
Controllers. See [The frame clock](/guide/scenes#the-frame-clock).

## The Controller

`createController` gives back the Controller. What a game uses:

| | |
|---|---|
| `id`, `type` | From its data. |
| `data` | Its data, the same object as `$`. |
| `hitTest(other)` | Whether it and `other` overlap where they're drawn. See [Collision](/guide/collision). |
| `distanceTo(x, y)` | How far its `x`, `y` is from a point. |
| `direction(x, y)` | The angle from its `x`, `y` to a point, in radians. |
| `attach(part)` | Carries another Controller. See [Attached Controllers](/guide/attached-controllers). |
| `carrier()` | The Controller carrying it, if one is. |
| `childControllers()` | The Controllers it carries. |
| `age()` | How many unpaused Ticks it has run. |
| `currentFrame()` | The Frame on screen. |
| `sprite()` | Its Sprite: what the Renderers draw. |

`distanceTo` and `direction` measure from its `x` and `y`, which is its
top-left corner, not its middle.

A Controller is in a Scene once it's added with `scene.addController`, and
out again with `scene.removeController(id)`. One Controller belongs in one
Scene.
