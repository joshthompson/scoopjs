# Canvas Issues

A **Canvas Issue** is something a Controller asks for that the Canvas
Renderer can't draw, such as `children` or a `clip-path`. It's reported
rather than drawn, so nothing goes missing silently. Each tells you what
can't be drawn, which Controller asked, where it was made, and how to fix
it.

The DOM Renderer draws everything, so it never has any.

## On the console

Each issue is logged with `console.error`, the first time it's drawn:

```
[scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")
  created at src/draw/sprites.tsx:27
  called from src/draw/course.tsx:112
  fix: clip with ctx.clip() in a Draw Hook
```

- **The first line** always starts `[scoopjs:canvas] unsupported`, then the
  feature, then the Controller's type and one example id. Search the
  console for `[scoopjs:canvas]` to find them all.
- **`url:`** is the image that failed, for an `image` issue.
- **`created at`** is the file and line that called `createController` (or
  `createConnectedController`): the first place outside ScoopJS.
- **`called from`** is what called that line, nearest first, up to three
  places, in your own code only (not in `node_modules` or Vite's bundled
  dependencies). It's there for a Controller made by a helper of your own,
  where the line to change is where the helper's called from.
- **`fix:`** says what to do, where there's a way.

An issue about the Scene itself says `on scene "level-1"` in place of a
type and id.

::: warning Line numbers under Vite
In development, `created at` names the right file, but its line is in the
compiled file Vite serves, not your source, since browsers don't map stack
traces through source maps. The type and id are the reliable way to find
the Controller.
:::

## `scene.canvasIssues()`

`scene.canvasIssues()` gives the same issues as plain records, in the order
they were reported, ready for `JSON.stringify`. One call lists everything,
for you or an agent porting a game:

```json
[
	{
		"feature": "style.clip-path",
		"type": "branch",
		"id": "branch-12",
		"createdAt": "src/draw/sprites.tsx:27",
		"calledFrom": ["src/draw/course.tsx:112"],
		"fix": "clip with ctx.clip() in a Draw Hook"
	},
	{
		"feature": "scene.cameraLayer",
		"fix": "it does nothing under the Canvas Renderer, so leave it off"
	}
]
```

Each record is a `CanvasIssue`:

| Field | What it is |
|---|---|
| `feature` | What can't be drawn. See [the list below](#what-s-reported). |
| `type` | The type of Controller that asks for it. Missing for the Scene's own. |
| `id` | One Controller of that type that asks for it. |
| `url` | The image that failed to load, for an `image` issue. |
| `createdAt` | Where that Controller was created, as `file:line`. |
| `calledFrom` | What called the code at `createdAt`, nearest first, up to three. |
| `fix` | How to fix it, where there's a way. |

Fields with nothing to say are left out. The records are copies, so
changing them changes nothing. Under the DOM Renderer the list is always
empty.

To read it from the browser's console, put the Scene somewhere you can
reach it while developing:

```ts
import { Scene } from 'scoopjs'

const scene = new Scene('level-1', { width: 960, height: 540 })
if (import.meta.env.DEV) Object.assign(window, { scene })
// then, in the console: scene.canvasIssues()
```

## Reported once

Each issue is reported **once per Controller type and feature**, in each
Scene: a hundred trees with the same `clip-path` are one issue, naming one
of them. That keeps the list short, but it means:

- Fixing one feature of a type can reveal the next. Fix, play again, and
  look again.
- Two kinds of thing sharing one `type` share their reports. If both have
  `children`, only the first one drawn is named.

Issues are found **by drawing**. Nothing is reported for a Controller until
it's in view, and `style` can change during play, so finding them all means
playing through every level, to the end.

## What's reported

| Feature | What asked for it |
|---|---|
| `children` | The Controller has `children`. |
| `class` | It has a `class`, from the option or its data. |
| `inner.style` | Its `inner.style` has anything in it. |
| `style.<key>` | A `style` key the Canvas Renderer doesn't translate, such as `style.clip-path` or `style.--glow`. |
| `style.<key> <value>` | A key it does translate, with a value it can't read, such as `style.opacity var(--o)` or `style.translate 1em 2em`. |
| `style.filter <name>()` | A `filter` function it doesn't draw, or can't read the arguments of, or any `drop-shadow` after the first. Something that isn't a function at all is named as it's written. |
| `style.transform <name>()` | A `transform` function it doesn't draw, such as `matrix()` or `rotateX()`, or can't read the arguments of. |
| `$ref` | Its `onMount` read `$ref`, which has no element under the Canvas Renderer. |
| `image` | One of its images failed to load. Once per type, however many fail. |
| `scene.cameraLayer`, `scene.standbyFrames` | The Scene has these DOM-only options on. Reported as soon as the Canvas Renderer is mounted. |

What isn't reported:

- `style` keys left as `undefined`, `null` or `''`, since the page leaves
  them out too.
- `filter: none`.
- For a Controller with a **Draw Hook**: its `children`, and the `style`
  keys and `filter` functions it doesn't translate. The hook has taken over
  painting it, so what it looks like is up to the hook. Its `class`,
  `inner.style`, unreadable values and `transform` functions are still
  reported, since the hook's context is set up from them.
- `children` with the Scene's `skipChildren` bench switch on.

## Fixing each kind

Most issues are fixed by drawing the thing in a [Draw
Hook](/renderers/draw-hooks). The `fix` line says what to do for the common
ones:

| Feature | Fix |
|---|---|
| `children` | Draw it in a Draw Hook. |
| `class` | Move what the class does into `style`, or a Draw Hook. |
| `inner.style` | Move it into `style`, or paint the Frame your own way in a Draw Hook. |
| `style.transition` | Tween the value over Ticks in `onEnterFrame` instead. |
| `style.animation` | Step it over Ticks in `onEnterFrame`, or use Frames. |
| `style.clip-path`, `style.mask` | Clip with `ctx.clip()` in a Draw Hook. |
| `style.border-radius` | Clip to a rounded rectangle in a Draw Hook. |
| `style.border`, `style.outline` | Stroke it in a Draw Hook. |
| `style.box-shadow` | Use `filter: drop-shadow(...)`, which is translated, or a Draw Hook. |
| `style.background` | Make it a Frame, or fill it in a Draw Hook. |
| `style.mix-blend-mode` | Set `ctx.globalCompositeOperation` in a Draw Hook. |
| `style.--anything` | Custom properties only reach `children` and classes: draw what reads it in a Draw Hook. |
| `style.color`, `style.font` | Draw the text with `ctx.fillText` in a Draw Hook. |
| `style.rotate` | Use the Controller's `rotation`, which is translated. |
| `style.scale` | Use the Controller's `xScale` and `yScale`. |
| `style.top`, `style.left` | Move it with the Controller's `x` and `y`. |
| `style.width`, `style.height` | Size it with the Controller's `width` and `height`. |
| `style.pointer-events` | Find what a click lands on with `scene.controllersAt`. |
| `style.cursor` | Set the cursor on the Renderer, from `scene.controllersAt`. |
| `style.will-change` | It does nothing on a canvas, so it can go. |
| `style.filter opacity()` | Use the `opacity` key, which is translated. |
| `style.filter drop-shadow()` | A canvas casts one `drop-shadow`, its lengths in `px`: keep one, or draw the rest in a Draw Hook. |
| `style.transform matrix()` | Write it as `translate`, `scale`, `rotate` and `skew`. |
| `style.transform rotateZ()` | Use `rotate()`, which is the same on a canvas. |
| `style.transform rotateX()` and other 3D | A canvas is flat: leave it out, or fake it with `scale` or `skew`. |
| `style.<key> <value>` | Give it a value a canvas can read: a number or percentage for `opacity`, a whole number for `z-index`, lengths in `px` or `%` for `translate` and `transform-origin`. |
| `$ref` | Do what `onMount` does to the element with the Controller's data and a Draw Hook. |
| `image` | Check the image is where the URL says, and what the Scene's `resolveAsset` gives for it. |
| `scene.cameraLayer`, `scene.standbyFrames` | They do nothing under the Canvas Renderer, so leave them off. |

A Controller with a Draw Hook is still reported for its `class`. While a
game runs under both Renderers, give the class only when the DOM Renderer
is in use:

```ts
import { createController } from 'scoopjs'

// However the game chooses its Renderer
const canvas = new URLSearchParams(location.search).get('renderer') === 'canvas'

export const crystal = createController({
	init: () => ({
		id: 'crystal',
		type: 'crystal',
		x: () => 10,
		y: () => 10,
		width: () => 20,
		height: () => 20,
		// The page's CSS clips and sparkles it under the DOM Renderer...
		class: () => (canvas ? undefined : 'crystal'),
	}),
	// ...and this under the Canvas Renderer
	draw: ({ ctx, drawDefault }) => {
		ctx.beginPath()
		ctx.moveTo(10, 0)
		ctx.lineTo(20, 10)
		ctx.lineTo(10, 20)
		ctx.lineTo(0, 10)
		ctx.clip()
		drawDefault()
	},
})
```
