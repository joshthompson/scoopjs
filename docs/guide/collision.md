# Collision

ScoopJS has two kinds of collision:

- **Solid** Controllers, which others with `blockedBySolid` can't move
  through. ScoopJS moves those back out for you.
- **Overlap** tests, `hitTest` and `isOverlapping`, which tell you two
  things touch, and leave what happens to you.

Neither reads the page. They work from the Controllers' own data, so a
Scene collides the same whichever Renderer draws it, or with none at all.

## Solid Controllers

**Solid**, of a Controller, means other Controllers can't move through it.
It has nothing to do with SolidJS.

```ts
import { createController } from 'scoopjs'

export function createWall(id: string, x: number, y: number) {
	return createController({
		solid: true,
		init: () => ({
			id,
			type: 'wall',
			x: () => x,
			y: () => y,
			width: () => 32,
			height: () => 128,
		}),
	})
}
```

`solid` is one of:

- `true`: its whole box.
- `false`, the default: nothing.
- A `Rect`, `{ x, y, width, height }`, from its own `x` and `y`: part of it,
  such as the top of a platform.
- A function giving one of those, for a solid part that changes.

Solid boxes go by a Controller's `x`, `y`, `width` and `height`, not its
rotation or scale. Only Controllers added to the Scene itself count, not
Attached Controllers.

## `blockedBySolid`

A Controller with `blockedBySolid: true` can't move into a solid one. After
its `onEnterFrame` each Tick, ScoopJS sweeps its box from where it was to
where it is now. If it would have gone into something solid, it's stopped
just short of it, and slides along it with whatever's left of the move.
A move with nothing in its way is left alone.

```ts
import { Key, createController, createObjectSignal } from 'scoopjs'

export const player = createController({
	blockedBySolid: true,
	init: () => ({
		id: 'player',
		type: 'player',
		...createObjectSignal(64, 'x'),
		...createObjectSignal(64, 'y'),
		width: () => 24,
		height: () => 24,
	}),
	onEnterFrame: ({ $ }) => {
		if (Key.isDown('ArrowRight')) $.setX($.x() + 4)
		if (Key.isDown('ArrowDown')) $.setY($.y() + 4)
	},
})
```

It needs `setX` and `setY` in its data, to move it back.

`blockBySolids(data, prevX, prevY)` and `blockBySolidsRectPlayer(data,
prevX, prevY)` do the same by hand: the first for a point (its `x` and `y`
only), the second for its whole box, as `blockedBySolid` does. Call them
after moving `data` from `prevX`, `prevY`. Both use the Scene in
`data.scene`.

## `hitTest`

`controller.hitTest(other)` is true when the two overlap where they're
drawn:

```ts
import type { AnyController, Scene } from 'scoopjs'

/** Takes every coin `collector` touches out of the Scene. */
export function collectCoins(collector: AnyController, scene: Scene) {
	for (const coin of scene.getControllersByType('coin')) {
		if (collector.hitTest(coin)) scene.removeController(coin.id)
	}
}
```

Call it from the collector's `onEnterFrame`, with `$controller` and
`$scene`.

"Where they're drawn" takes in everything that moves a Sprite on the screen:

- Attached Controllers, through every carrier;
- `rotation`, `xScale` and `yScale` (flips too), about `origin`;
- a `style`'s `transform`, `translate` and `transform-origin`;
- `parallax`, and so the camera.

Each is compared as the upright box around it. A Sprite turned 45° hits
across the box around its corners, not its diamond shape. Touching edges
count as overlapping.

## Other helpers

| | |
|---|---|
| `isOverlapping(a, b)` | Whether two `Rect`s overlap. Touching counts, and either missing is `false`. |
| `controller.distanceTo(x, y)` | How far its `x`, `y` is from a point. |
| `controller.direction(x, y)` | The angle from its `x`, `y` to a point, in radians, for `Math.cos` and `Math.sin`. |
| `scene.getSolidControllerRects()` | The solid boxes in the Scene, in Scene pixels. |

`distanceTo` and `direction` measure from a Controller's top-left corner.
For its middle, add half its size:

```ts
import type { AnyController } from 'scoopjs'

export function chase(hunter: AnyController, target: AnyController) {
	const $ = target.data
	const angle = hunter.direction($.x() + $.width() / 2, $.y() + $.height() / 2)
	hunter.data.setX?.(hunter.data.x() + Math.cos(angle) * 2)
	hunter.data.setY?.(hunter.data.y() + Math.sin(angle) * 2)
}
```

To find what's under the pointer, see [Which Controller was
clicked](/guide/input#which-controller-was-clicked).
