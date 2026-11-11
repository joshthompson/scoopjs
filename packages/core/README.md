# ScoopJS

A small game engine for [SolidJS](https://www.solidjs.com), where Solid
components are the game objects. A `Scene` ticks its controllers, and each
controller is drawn as a sprite that follows its own signals. The engine has no
draw loop of its own: Solid's reactivity does the drawing.

Pre-1.0: any minor version can break the API.

```sh
pnpm add scoopjs solid-js
```

```tsx
import { Canvas, Key, Scene, createController } from 'scoopjs'
import { createSignal } from 'solid-js'
import busImage from './bus.png'

const bus = createController({
	frames: [busImage],
	init: () => {
		const [x, setX] = createSignal(0)
		return {
			id: 'bus',
			type: 'bus',
			x,
			setX,
			y: () => 100,
			width: () => 64,
			height: () => 32,
		}
	},
	onEnterFrame: ({ $ }) => {
		if (Key.isDown('ArrowRight')) $.setX?.($.x() + 2)
	},
})

const scene = new Scene('demo', {
	width: 320,
	height: 180,
	frameRate: 1000 / 60,
	setup: (scene) => scene.addController(bus),
})

export const Game = () => <Canvas scene={scene} />
```

## The pieces

- **`Scene`** is one running game world. It ticks every `frameRate`
  milliseconds while its canvas is on the screen. Each tick, every
  controller's `onEnterFrame` runs, and then every ticker. All of a tick is
  one Solid `batch`.
- **`createController`** makes one thing in a scene: its data (signals) and
  what it does each tick. `createConnectedController` makes one that rides
  on another, and `attach` hangs one controller on another.
- **`Canvas`** draws a scene. It's DOM elements, not a `<canvas>`. Pass
  `style` to change its background, which is white by default.
- **`Sprite`** is how a controller looks: its frames (image URLs, optionally
  `url#left,top,width,height` for part of a sprite sheet), size, scale and
  rotation.
- **`Key`** gives keyboard state as signals: `Key.isDown('ArrowLeft')`.
- **`blockBySolids`** and **`isOverlapping`** handle collisions.
  `hitTest` compares two controllers' own rects, never the page.

### Options a game passes in

- **`resolveAsset`** (on `Scene`) swaps every image URL for the one to
  actually show, such as a seasonal version of it.
- **`--scoopjs-modal-backdrop`** is the CSS colour behind `scene.modal`. Set it
  on your canvas (`transparent` for none).

## Building with Vite

`vite-plugin-solid` picks up the package's `solid` export condition by itself,
and compiles ScoopJS against your app's own copy of Solid. If you work on
ScoopJS through `pnpm link`, add `resolve: { dedupe: ['solid-js'] }` to your
Vite config. Without it, the linked copy brings its own Solid, and signals
silently stop updating across the two.
