/**
 * The issue reporter: the Canvas Issues a Scene has had, kept for it by the
 * Canvas Renderer, which is the only thing that finds them. The Scene serves
 * them back through `canvasIssues()` without knowing what drew it.
 */
import type { AnyController } from './Controller'
import type { Scene } from './Scene'
import { childrenToDraw } from './children'
import { absent } from './cssValues'
import { isTranslatedTransform } from './geometry'
import { translateStyle } from './styleTranslator'

/** Something a Controller asks for that the Canvas Renderer can't draw. */
export interface CanvasIssue {
	/**
	 * What can't be drawn: `children`, `class`, `inner.style`, a `style` key
	 * such as `style.clip-path`, a function in one such as
	 * `style.filter blur`, `$ref`, `image` for an image that fails to load,
	 * or one of the Scene's own options such as `scene.cameraLayer`.
	 */
	feature: string
	/** The type of Controller that asks for it, unless the Scene does. */
	type?: string
	/** One Controller of that type that asks for it. */
	id?: string
	/** The image that failed to load, for an `image` issue. */
	url?: string
	/** Where that Controller was created, as a file and line. */
	createdAt?: string
	/**
	 * What called the code at `createdAt`, nearest first, up to three files and
	 * lines: for a Controller made by a game's own helper, where the helper's
	 * called from is the line to change.
	 */
	calledFrom?: string[]
	/** How to fix it, where there's a way. */
	fix?: string
}

// The stack each Controller was created with, kept as it came, since it's
// only worth reading for the few that turn out to have an issue.
const creations = new WeakMap<AnyController, string>()

/**
 * Keeps `stack`, the stack `createController` was called with, to say where
 * `controller` was created if it has a Canvas Issue.
 */
export function recordCreation(
	controller: AnyController,
	stack: string | undefined,
) {
	if (stack) creations.set(controller, stack)
}

/**
 * Where a stack frame points, as a file and line: `src/draw/sprites.tsx:27`
 * from `at branch (http://localhost:5173/src/draw/sprites.tsx?t=1:27:12)` as
 * V8 writes it, or `branch@http://...` as Firefox and Safari do. The page's
 * origin and any query are left out, so the file is as the project has it.
 */
function location(frame: string) {
	const line = frame.trim()
	let place = line.split(/\s+/).pop() ?? ''
	if (!line.startsWith('at ')) place = line.slice(line.indexOf('@') + 1)
	const parts = place.replace(/^\(|\)$/g, '').match(/^(.+):(\d+):\d+$/)
	if (!parts) return undefined
	// A page's file is relative to its origin, and a file on disk keeps its
	// whole path
	const file = parts[1]
		.replace(/^https?:\/\/[^/]*\//i, '')
		.replace(/^file:\/\//i, '')
	return { file: file.split('?')[0], line: parts[2] }
}

/**
 * Where `controller` was created: the first frame of its creation's stack
 * outside ScoopJS. The first frame is `createController` itself, so anything
 * in the same file is ScoopJS's own, such as `createConnectedController`.
 * That's one file whether ScoopJS is bundled or not.
 */
function callers(controller: AnyController) {
	const stack = creations.get(controller)
	if (!stack) return []
	const frames = stack.split('\n').flatMap((frame) => location(frame) ?? [])
	const own = frames[0]?.file
	return frames
		.filter((frame) => frame.file !== own)
		.map((frame) => `${frame.file}:${frame.line}`)
}

function createdAt(controller: AnyController) {
	return callers(controller)[0]
}

/**
 * The next few callers after `createdAt`, in the game's own code: not a
 * library's, such as Solid's, nor Vite's bundle of them.
 */
function calledFrom(controller: AnyController) {
	const after = callers(controller)
		.slice(1)
		.filter((place) => !/node_modules|\.vite\/deps/.test(place))
		.slice(0, 3)
	return after.length > 0 ? after : undefined
}

/** What every Canvas Issue on the console starts with. */
const prefix = '[scoopjs:canvas]'

// Each Scene's issues, by type and feature, so each is reported once
const issues = new WeakMap<Scene, Map<string, CanvasIssue>>()

/**
 * Reports `issue` with `console.error`, unless the same feature has been
 * reported for the same type of Controller in this Scene already. Cheap for
 * one that has, since it's checked every time a Controller is painted.
 */
export function reportCanvasIssue(scene: Scene, issue: CanvasIssue) {
	let reported = issues.get(scene)
	if (!reported) {
		reported = new Map()
		issues.set(scene, reported)
	}
	const key = `${issue.type ?? ''}\n${issue.feature}`
	if (reported.has(key)) return
	// A plain record from here on, without whatever it left undefined, so it
	// reads the same as JSON
	const record = JSON.parse(JSON.stringify(issue)) as CanvasIssue
	reported.set(key, record)
	console.error(describeIssue(scene, record))
}

/** A Scene's Canvas Issues so far, in the order they were reported. */
export function canvasIssuesOf(scene: Scene): CanvasIssue[] {
	// Copies, so a caller can't change what's been reported
	return [...(issues.get(scene)?.values() ?? [])].map((issue) => ({
		...issue,
	}))
}

/**
 * An issue as the console shows it: a first line an agent can search for,
 * then where to look and what to do, each on a line of its own.
 */
function describeIssue(scene: Scene, issue: CanvasIssue) {
	const on =
		issue.type === undefined
			? `on scene "${scene.id}"`
			: `on type "${issue.type}" (id "${issue.id}")`
	return [
		`${prefix} unsupported ${issue.feature} ${on}`,
		issue.url && `  url: ${issue.url}`,
		issue.createdAt && `  created at ${issue.createdAt}`,
		issue.calledFrom && `  called from ${issue.calledFrom.join(', then ')}`,
		issue.fix && `  fix: ${issue.fix}`,
	]
		.filter(Boolean)
		.join('\n')
}

/** The Scene's options that only the DOM Renderer uses. */
const domOnlyOptions = ['cameraLayer', 'standbyFrames'] as const

/**
 * Reports the Scene's options that do nothing under the Canvas Renderer, if
 * they're on: once it's put on the page, since they're set for good.
 */
export function reportSceneIssues(scene: Scene) {
	for (const option of domOnlyOptions) {
		if (!scene.options[option]) continue
		reportCanvasIssue(scene, {
			feature: `scene.${option}`,
			fix: 'it does nothing under the Canvas Renderer, so leave it off',
		})
	}
}

/**
 * Reports that `url`, which `controller` shows as a Frame, can't be loaded:
 * once for its type, however many of its images can't, since one is enough
 * to say where to look.
 */
export function reportMissingImage(
	scene: Scene,
	controller: AnyController,
	url: string,
) {
	reportIssueOf(
		scene,
		controller,
		'image',
		"check the image is where the URL says, and what the Scene's resolveAsset gives for it",
		url,
	)
}

/** Reports `feature` for `controller`'s type. */
function reportIssueOf(
	scene: Scene,
	controller: AnyController,
	feature: string,
	fix?: string,
	url?: string,
) {
	reportCanvasIssue(scene, {
		feature,
		type: controller.type,
		id: controller.id,
		url,
		// Only worked out for an issue it hasn't reported already
		get createdAt() {
			return createdAt(controller)
		},
		get calledFrom() {
			return calledFrom(controller)
		},
		fix,
	})
}

/**
 * Runs `controller`'s `onMount`, as the DOM Renderer does when it puts its
 * Sprite on the page. There's no element under the Canvas Renderer, so
 * `$ref` is undefined, and reading it is a Canvas Issue: an `onMount` that
 * doesn't isn't reported.
 */
export function mountWithoutElement(scene: Scene, controller: AnyController) {
	controller.sprite().onMount?.({
		get $ref() {
			reportIssueOf(
				scene,
				controller,
				'$ref',
				"do what onMount does to the element with the Controller's data and a Draw Hook",
			)
			return undefined
		},
	})
}

/**
 * Reports whatever `controller` asks for that the Canvas Renderer can't
 * draw, as it's about to be painted.
 */
export function reportControllerIssues(
	scene: Scene,
	controller: AnyController,
) {
	const sprite = controller.sprite()
	const report = (feature: string, fix?: string) =>
		reportIssueOf(scene, controller, feature, fix)
	if (sprite.class) {
		report('class', 'move what the class does into style or a Draw Hook')
	}
	const inner = (sprite.inner?.style ?? {}) as Record<string, unknown>
	if (Object.values(inner).some((value) => !absent(value))) {
		report(
			'inner.style',
			'move it into style, or paint the Frame your own way in a Draw Hook',
		)
	}
	// A Draw Hook has taken over painting the Sprite, so what it looks like
	// is up to the hook: only what's still to port is reported. The children
	// can stay for the DOM Renderer.
	const drawn = controller.draw !== undefined
	if (!drawn && childrenToDraw(scene, sprite) !== undefined) {
		report('children', drawHook)
	}
	const style = translateStyle(sprite.style)
	if (!drawn) {
		for (const key of style.untranslatable) {
			report(`style.${key}`, styleFix(key))
		}
		const filter = String(sprite.style?.filter)
		for (const name of style.unsupportedFilters) {
			// Something that isn't a function at all is named as it's written
			const written = filter.includes(`${name}(`) ? `${name}()` : name
			report(`style.filter ${written}`, filterFixes[name] ?? drawHook)
		}
	}
	// Where the Sprite is drawn, its alpha and its image smoothing, which a
	// Draw Hook's context is set to already, so these are still reported
	// with one.
	for (const key of style.unreadable) {
		const value = (sprite.style as Record<string, unknown>)[key]
		report(`style.${key} ${String(value)}`, unreadableFixes[key])
	}
	for (const name of style.unsupportedTransforms) {
		report(`style.transform ${name}()`, transformFix(name))
	}
}

/** How to do without a `filter` function a canvas doesn't draw. */
const filterFixes: Record<string, string> = {
	opacity: 'use style.opacity, which is translated',
	grayscale: 'use saturate(), which is translated: saturate(0) is grayscale(1)',
	'drop-shadow':
		'a canvas casts one drop-shadow, its lengths in px: keep one, or draw the rest in a Draw Hook',
}

/** How to write a translated `style` key's value so a canvas can read it. */
const unreadableFixes: Record<string, string> = {
	opacity: 'give it a number or a percentage, which a canvas can read',
	'z-index': 'give it a whole number, which a canvas can read',
	translate: 'give it lengths in px or %, which a canvas can read',
	'transform-origin':
		'give it lengths in px or % or keywords such as left and top, which a canvas can read',
	'image-rendering':
		'give it pixelated, crisp-edges, auto or smooth, which a canvas can read',
}

/** How to do without a `transform` function a canvas doesn't draw. */
function transformFix(name: string) {
	if (name === 'matrix') {
		return 'write it as translate, scale, rotate and skew, which are translated'
	}
	if (name === 'rotateZ') return 'use rotate(), which is the same on a canvas'
	if (/^(rotate[XY]|translateZ|scaleZ|perspective)$|3d$/.test(name)) {
		return 'a canvas is flat: leave it out, or fake it with scale or skew'
	}
	if (isTranslatedTransform(name)) {
		return 'give it arguments a canvas can read: lengths in px or %, angles with a unit'
	}
	return 'use translate, scale, rotate or skew, which are translated'
}

/** Draws it in a Draw Hook: the fix for most of what a canvas can't. */
const drawHook = 'draw it in a Draw Hook'

/**
 * How to do without a `style` key, for the ones games use. Prefixes cover
 * the families of keys, such as `background-image` and `transition-duration`.
 */
const styleFixes: [prefix: string, fix: string][] = [
	['transition', 'tween the value over Ticks in onEnterFrame instead'],
	['animation', 'step it over Ticks in onEnterFrame, or use Frames'],
	['clip-path', 'clip with ctx.clip() in a Draw Hook'],
	['mask', 'clip with ctx.clip() in a Draw Hook'],
	['border-radius', 'clip to a rounded rectangle in a Draw Hook'],
	['border', 'stroke it in a Draw Hook'],
	['outline', 'stroke it in a Draw Hook'],
	[
		'box-shadow',
		'use filter: drop-shadow(...), which is translated, or a Draw Hook',
	],
	['background', 'make it a Frame, or fill it in a Draw Hook'],
	['mix-blend-mode', 'set ctx.globalCompositeOperation in a Draw Hook'],
	[
		'--',
		'custom properties only reach children and classes: draw what reads it in a Draw Hook',
	],
	['color', 'draw the text with ctx.fillText in a Draw Hook'],
	['font', 'draw the text with ctx.fillText in a Draw Hook'],
	['rotate', "use the Controller's rotation, which is translated"],
	['scale', "use the Controller's xScale and yScale, which are translated"],
	['top', "move it with the Controller's x and y"],
	['left', "move it with the Controller's x and y"],
	['width', "size it with the Controller's width and height"],
	['height', "size it with the Controller's width and height"],
	['pointer-events', 'find what a click lands on with scene.controllersAt'],
	['cursor', 'set the cursor on the Renderer, from scene.controllersAt'],
	['will-change', 'it does nothing on a canvas, so it can go'],
]

function styleFix(key: string) {
	return styleFixes.find(([prefix]) => key.startsWith(prefix))?.[1] ?? drawHook
}
