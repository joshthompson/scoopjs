# Input

## The keyboard: `Key`

`Key` gives which keys are down, as signals. It listens on `window` once,
for the whole page.

```ts
import { Key, createController, createObjectSignal } from 'scoopjs'

export const ship = createController({
	init: () => ({
		id: 'ship',
		type: 'ship',
		...createObjectSignal(100, 'x'),
		y: () => 400,
		width: () => 32,
		height: () => 32,
	}),
	onEnterFrame: ({ $ }) => {
		if (Key.isDown('ArrowLeft')) $.setX($.x() - 4)
		if (Key.isDown('ArrowRight')) $.setX($.x() + 4)
		if (Key.isDown(' ')) {
			// fire
		}
	},
})
```

- Keys are named as `KeyboardEvent.key` names them: `'ArrowLeft'`, `' '`
  for the space bar, `'a'`. A letter with Shift held is a capital: `'A'`.
- `Key.isDown(key)` is whether it's down now. It's a signal read, so
  anything reactive that calls it updates when the key goes up or down.
- `Key.get(key)` is the signal itself, an accessor, to pass around.
- `Key.emulateKeydown(key, ms)` holds a key down for `ms` milliseconds, 100
  unless given. It suits on-screen buttons that should act like keys.

```tsx
import { Key } from 'scoopjs'

export const JumpButton = () => (
	<button type="button" onPointerDown={() => Key.emulateKeydown(' ', 150)}>
		Jump
	</button>
)
```

Reading keys in `onEnterFrame` means a Controller reacts on the next Tick,
and not while the Scene is paused.

## The pointer

Both Renderers take `onClick`, `onMouseDown` and `onMouseUp`. Each is given
where the pointer is, as `{ x, y }` in the **Scene's coordinates**:

- the camera's position is added on, so it's a point in the world, not on
  the screen;
- a Renderer scaled with CSS, to fit the window say, is allowed for, so it's
  in the Scene's pixels, not the screen's.

```tsx
import { DomRenderer, type Scene, type Vector } from 'scoopjs'

export const Board = (props: { scene: Scene }) => {
	const clicked = (at: Vector) => console.log('clicked at', at.x, at.y)
	return <DomRenderer scene={props.scene} onClick={clicked} />
}
```

On a touch screen, a touch calls `onClick` and `onMouseDown` as it starts,
and `onClick` and `onMouseUp` as it ends, with where it ended.

The coordinates are worked out the same way by both Renderers, so input
code doesn't change when a game switches.

## Which Controller was clicked

`scene.controllersAt(point)` is the **Pointer Pick**: the Controllers drawn
over a point, topmost first. It takes the point the Renderer's handlers
give:

```tsx
import { CanvasRenderer, type Scene, type Vector } from 'scoopjs'

export const Board = (props: { scene: Scene }) => {
	const select = (at: Vector) => {
		const [top] = props.scene.controllersAt(at)
		if (top?.type === 'piece') console.log('picked', top.id)
	}
	return <CanvasRenderer scene={props.scene} onClick={select} />
}
```

- It goes by where each Controller is drawn: Attached Controllers through
  their carriers, rotation, scale, flips, a `style`'s transforms, and
  parallax. Like `hitTest`, it uses the upright box around each.
- It's in draw order, so the first is the one on top.
- Controllers hidden by `visibility: hidden` or `display: none`, their own
  or a carrier's, are left out. `opacity: 0` isn't hidden.
- It gives the same answer under either Renderer.

A Controller's Sprite never gets pointer events of its own: its element has
`pointer-events: none` under the DOM Renderer, and there's no element under
the Canvas Renderer. The Renderer's handlers and the Pointer Pick are the way
to click on things.

## Buttons and menus

The Renderer's `underlay`, `overlay`, `underDialog` and `dialog` are page
elements under both Renderers. Buttons and menus there are ordinary Solid
components, with their own handlers:

```tsx
import { CanvasRenderer, type Scene } from 'scoopjs'

export const Level = (props: { scene: Scene }) => (
	<CanvasRenderer
		scene={props.scene}
		overlay={
			<button
				type="button"
				class="pause"
				onClick={(event) => {
					// Not a click on the Scene as well
					event.stopPropagation()
					props.scene.modal.set(<p>Paused</p>)
				}}
			>
				Pause
			</button>
		}
	/>
)
```

The Renderer's `onClick` is on its own element, so a click on a button in
the `overlay` reaches it too unless the button stops it.
