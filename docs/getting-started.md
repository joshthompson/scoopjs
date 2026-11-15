# Getting started

This page installs ScoopJS, builds a small game with one Scene, one
Controller and a Renderer, and explains what happens on each Tick.

You'll need a SolidJS app built with [Vite](https://vite.dev) and
`vite-plugin-solid`. ScoopJS lists `solid-js` 1.9 or later as a peer
dependency, so the game and the engine share one copy of Solid.

## Install

ScoopJS is on GitHub Packages, as `@joshthompson/scoopjs`. Install it under
the alias `scoopjs`, so imports don't change when it moves registry or name.

1. Point the `@joshthompson` scope at GitHub Packages, in an `.npmrc` next to
   your `package.json`:

   ```ini
   @joshthompson:registry=https://npm.pkg.github.com
   ```

2. Give your package manager a token. GitHub Packages asks for one even to
   install. Make a token with the `read:packages` scope and put it in
   `~/.npmrc`, so it never ends up in the repo:

   ```ini
   //npm.pkg.github.com/:_authToken=YOUR_TOKEN
   ```

3. Add the package and Solid:

   ```sh
   pnpm add scoopjs@npm:@joshthompson/scoopjs solid-js
   ```

   In `package.json` that's `"scoopjs": "npm:@joshthompson/scoopjs@^0.3.0"`.

### In CI

CI needs a token too. In GitHub Actions, write one into `~/.npmrc` before
installing. The repo's own `GITHUB_TOKEN` works if the job has
`packages: read` and the package grants your repo access in its settings:

```yaml
permissions:
  contents: read
  packages: read

steps:
  - name: Log in to GitHub Packages
    run: echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" > ~/.npmrc
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  - run: pnpm install --frozen-lockfile
```

### With Vite

`vite-plugin-solid` finds the package's `solid` export condition by itself,
and compiles ScoopJS against your app's own copy of Solid. Nothing else is
needed.

If you work on ScoopJS itself and link it into a game with `pnpm link`, add
`resolve: { dedupe: ['solid-js'] }` to the game's Vite config. Without it the
linked copy brings its own Solid, and signals silently stop updating between
the two.

## A first game

A bus that drives left and right with the arrow keys. Three pieces: a
Controller for the bus, a Scene to run it, and a Renderer to draw it.

```tsx
// game.tsx
import { DomRenderer, Key, Scene, createController } from 'scoopjs'
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
		if (Key.isDown('ArrowLeft')) $.setX?.($.x() - 2)
	},
})

const scene = new Scene('road', {
	width: 320,
	height: 180,
	// A Tick every 1000 / 60 ms: 60 a second
	frameRate: 1000 / 60,
	setup: (scene) => scene.addController(bus),
})

export const Game = () => <DomRenderer scene={scene} />
```

Mount it as any Solid component:

```tsx
// index.tsx
import { render } from 'solid-js/web'
import { Game } from './game'

const root = document.getElementById('app')
if (root) render(() => <Game />, root)
```

What each piece does:

- **`createController`** makes the bus. `init` gives its data: an `id`, a
  `type`, and its position and size as signals (`x`, `y`, `width`,
  `height`). `frames` is the image it shows. `onEnterFrame` runs every
  Tick, and `$` is its data. See [Controllers](/guide/controllers).
- **`new Scene`** is the game world: 320×180 pixels, ticking 60 times a
  second. `setup` adds the bus. See [Scenes](/guide/scenes).
- **`DomRenderer`** draws the Scene on the page, the bus as a `<div>` with
  its image as the background. Swap it for `CanvasRenderer` to paint onto a
  `<canvas>` instead; nothing else changes. See
  [Choosing a Renderer](/renderers/).
- **`Key`** gives keyboard state. See [Input](/guide/input).

::: tip The Scene goes with its Renderer
When a Renderer is unmounted, it destroys its Scene: the Scene stops
ticking for good. A game that leaves and comes back to a Scene makes a new
one each time, for example inside the component that renders it. See
[Destroying a Scene](/guide/scenes#destroying-a-scene).
:::

## The game loop

A Scene has no draw loop. It runs a timer, and on every Tick it changes
signals. Solid then updates whatever reads them.

Every `frameRate` milliseconds (40 unless you say otherwise), while any of
the Scene is on the screen, one Tick runs, all inside one Solid `batch`:

1. Unless the Scene is paused, each Controller's `onEnterFrame` runs, in the
   order they were added. A Controller's [Attached
   Controllers](/guide/attached-controllers) run straight after it.
2. Every Controller's Frame steps on, if it's animating (on the default
   `'tick'` [frame clock](/guide/scenes#the-frame-clock)).
3. Every Ticker in `scene.tickers` runs, paused or not.
4. The Scene's `afterEnterFrames` option runs, paused or not.

Because it's one batch, the page updates once per Tick with everything that
moved, not once per signal.

The Scene is **paused** while it's loading its images or while a Modal is
up (`scene.isActive()` is false). Paused, Controllers don't move or animate,
but Tickers still run.

The Scene **doesn't tick at all** while it's off the screen, such as
scrolled out of view. It carries on from where it was when it's back. A
Renderer's `runOffScreen` prop turns that off.

After a Tick, the [DOM Renderer](/renderers/dom-renderer) has already
updated the page through Solid. The [Canvas
Renderer](/renderers/canvas-renderer) repaints on the next display frame.

## Next

- [Scenes](/guide/scenes): ticks, the camera, loading, Modals.
- [Controllers](/guide/controllers): data, `onEnterFrame`, Frames.
- [Choosing a Renderer](/renderers/): DOM or canvas.
