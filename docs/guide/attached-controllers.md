# Attached Controllers

An **Attached Controller** is carried by another Controller, its carrier.
It moves, turns and is drawn with it, such as a hat on a runner or a wheel
on a bus. A part can carry parts of its own: a hand on an arm on a runner.

## `attach`

```ts
import { createController, createObjectSignal } from 'scoopjs'
import hatImage from './hat.png'
import runnerImage from './runner.png'

export const runner = createController({
	frames: [runnerImage],
	init: () => ({
		id: 'runner',
		type: 'runner',
		...createObjectSignal(100, 'x'),
		...createObjectSignal(200, 'y'),
		width: () => 32,
		height: () => 48,
	}),
})

const hat = createController({
	frames: [hatImage],
	init: () => ({
		id: 'runner-hat',
		type: 'hat',
		// From the runner's top-left corner, not the Scene's
		x: () => 4,
		y: () => -12,
		width: () => 24,
		height: () => 16,
	}),
})

runner.attach(hat)
```

Add only the carrier to the Scene. Its parts come with it.

What being attached means:

- **Position.** A part's `x` and `y` are from its carrier's top-left corner,
  in the carrier's own pixels. It turns, flips and scales with its carrier,
  through every carrier above it.
- **Camera.** It moves with its carrier, so its own `parallax` doesn't
  count.
- **Each Tick.** Its `onEnterFrame` runs straight after its carrier's, in
  the order the parts were attached. Its carrier steps its Frames too.
- **Lookups.** `scene.getAllControllers()`, `getControllerById` and
  `getControllersByType` find it, however deep. It isn't in
  `scene.controllers`, which holds what was added to the Scene itself.
- **`carrier()`** gives its carrier, and the carrier's `childControllers()`
  gives its parts.
- **Collision.** `hitTest` and the Pointer Pick go by where it's drawn, its
  carriers and all. Only Controllers added to the Scene itself can be
  [solid](/guide/collision#solid-controllers), though.

## Draw order

A part is drawn straight after its carrier, over it, and before anything
that comes after the carrier. Parts are drawn in the order they were
attached.

A part's `z-index` (in its `style`) orders it among its carrier's other
parts, with the carrier counting as 0. A part with a `z-index` below 0 goes
under its carrier: a wheel behind a bus, say. It can't go under anything
outside its carrier.

## What a part inherits

On the page, the DOM Renderer nests each part inside its carrier's element,
so CSS passes things down. The Canvas Renderer works the same out for
itself:

| | |
|---|---|
| `opacity` | Multiplied through its carriers: a carrier at 0.5 fades its parts too. |
| `visibility: hidden` | Hides its parts, unless one says `visibility: visible`. |
| `display: none` | Hides everything it carries, whatever they say. |
| `filter` | A carrier's colour filters apply to its parts too, after their own. |
| `image-rendering` | Passed down, unless a part says otherwise. |

## `createConnectedController`

`createConnectedController` makes a part whose data comes from its carrier's
data, for parts that follow what their carrier is doing. It doesn't attach
the part itself: call `attach` too.

```ts
import {
	createConnectedController,
	createController,
	createObjectSignal,
} from 'scoopjs'
import plumeImage from './plume.png'
import runnerImage from './runner.png'

const runner = createController({
	frames: [runnerImage],
	init: () => ({
		id: 'runner',
		type: 'runner',
		...createObjectSignal(100, 'x'),
		...createObjectSignal(200, 'y'),
		width: () => 32,
		height: () => 48,
	}),
})

const plume = createConnectedController({
	base: runner,
	type: 'plume', // its type is 'runner-plume', and its id 'runner-plume'
	frames: [plumeImage],
	offset: { x: 12, y: -20 },
	width: () => 8,
	height: () => 12,
	// Bobs up and down with the runner's age, in Ticks
	y: (_, $age) => Math.sin($age / 4) * 2,
	// Tilts as the runner moves, from the runner's own data
	rotation: ($) => ($.x() % 40) / 4,
})

runner.attach(plume)
```

Its id is the carrier's id and `type` joined with a `-`. Its type is the
same, or whatever `type` gives back if it's a function of the carrier's
type.

| Option | What it is |
|---|---|
| `base` | Required. The carrier, whose data the others are given. |
| `type` | Required. A string, or a function of the carrier's type. |
| `offset` | Required. `{ x, y }`: where it sits on its carrier. |
| `width`, `height` | Required. `($) => number`, from the carrier's data. |
| `x`, `y` | `($, $age) => number`: added to `offset`, from the carrier's data and age. |
| `rotation` | `($, $age) => number`, in degrees. |
| `origin` | `{ x, y }`: what it turns and flips about. Its top-left corner unless given. `transformOrigin` is a deprecated name for it. |
| `xScale` | `($) => number`, from the carrier's data: -1 flips it. |
| `solid` | As for `createController`. |
| `frames`, `randomStartFrame` | As for `createController`. |
| `frame`, `frameInterval`, `state` | Functions of the carrier's data. |
| `style` | A function of the carrier's data, giving CSS. |
| `init` | `($, $age) => data`: more data of its own, merged over the rest. |
| `onEnterFrame`, `onMount`, `draw`, `drawReach` | As for `createController`. |

A part's `solid` is kept, but collision only checks Controllers added to
the Scene itself, so a part blocks nothing while it's attached.
