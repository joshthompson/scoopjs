# Plugins

A **Plugin** is a package of its own that a game can choose to use, built
only on Core's public API. It's never registered with Core. There aren't
any published yet; this page is how one should be built when there is.

The decision is [ADR 0001](/adr/0001-plugins-are-composition).

## Plugins are composition

A game calls a Plugin directly, as it would any other function or
component:

```tsx
const sounds = createSounds(scene, { jump: jumpSound })
const game = <DomRenderer scene={scene} overlay={<Debugger scene={scene} />} />
```

Core has no list of Plugins, no `plugins: [...]` option on a Scene, and no
lifecycle for them. What a Plugin gives back is typed by its own function,
for free, rather than living somewhere like `scene.plugins.sounds`.

When a Plugin needs a hook Core doesn't have, Core gains that hook as
ordinary public API, which any game can use too.

## What a Plugin can build on

Everything a game can use is open to a Plugin. The parts most useful to
one:

| | |
|---|---|
| `scene.tickers` | Run something at the end of every Tick, paused or not. |
| `scene.isActive()` | Whether the Scene is paused, by loading or a Modal. |
| `scene.getAllControllers()`, `getControllersByType` | What's in the Scene, attached parts too. |
| `scene.controllersAt(point)` | The Pointer Pick. |
| `scene.canvas` | The camera. |
| `scene.modal` | Show something over the Scene, pausing it. |
| A Renderer's `overlay`, `underlay` | Page elements over and under the Sprites. |
| `scene.canvasIssues()` | What the Canvas Renderer couldn't draw. |
| `createController` | Controllers of its own, which a game adds to its Scene. |

A Plugin that counts the Ticks the game has been running, and a component
that shows it:

```tsx
import type { Scene } from 'scoopjs'
import { createSignal } from 'solid-js'

/** How many unpaused Ticks `scene` has run since this was called. */
export function createStopwatch(scene: Scene) {
	const [ticks, setTicks] = createSignal(0)
	const tick = () => {
		if (scene.isActive()) setTicks(ticks() + 1)
	}
	scene.tickers.add(tick)
	return {
		ticks,
		stop: () => scene.tickers.delete(tick),
	}
}

export const Stopwatch = (props: { ticks: () => number }) => (
	<p class="stopwatch">{props.ticks()}</p>
)
```

A game uses it by calling it:

```tsx
import { DomRenderer, Scene } from 'scoopjs'
import { Stopwatch, createStopwatch } from 'scoopjs-stopwatch'

const scene = new Scene('level', { width: 960, height: 540 })
const stopwatch = createStopwatch(scene)

export const Game = () => (
	<DomRenderer
		scene={scene}
		overlay={<Stopwatch ticks={stopwatch.ticks} />}
	/>
)
```

## Packaging a Plugin

- List `scoopjs` (Core) and `solid-js` as **peer dependencies**, so a game
  and all its Plugins share one Core and one Solid. Two copies of Solid
  means signals silently stop updating between them.
- Use only what Core exports from its package. Nothing deeper is public.
- Use the [Glossary](/glossary)'s words for Core's things.

If three or more Plugins end up wanting the same hook in the same way,
that's the time to think about a registry again (see the ADR).
