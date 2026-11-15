import type { AnyController, Reach } from './Controller'
import { absent, angle, length } from './cssValues'
import type { Rect, Vector } from './types'

/**
 * A 2D transform, laid out as `DOMMatrix` and a canvas's `setTransform` take
 * it: a point (x, y) goes to (a·x + c·y + e, b·x + d·y + f).
 */
export interface Matrix {
	a: number
	b: number
	c: number
	d: number
	e: number
	f: number
}

const identity: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** `m` then `n`, as CSS lists them: `n` is applied to a point first. */
function multiply(m: Matrix, n: Matrix): Matrix {
	return {
		a: m.a * n.a + m.c * n.b,
		b: m.b * n.a + m.d * n.b,
		c: m.a * n.c + m.c * n.d,
		d: m.b * n.c + m.d * n.d,
		e: m.a * n.e + m.c * n.f + m.e,
		f: m.b * n.e + m.d * n.f + m.f,
	}
}

const translation = (x: number, y: number): Matrix => ({
	...identity,
	e: x,
	f: y,
})

const radians = (degrees: number) => (degrees * Math.PI) / 180

function rotation(degrees: number): Matrix {
	const cos = Math.cos(radians(degrees))
	const sin = Math.sin(radians(degrees))
	return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

const skewing = (x: number, y: number): Matrix => ({
	...identity,
	b: Math.tan(radians(y)),
	c: Math.tan(radians(x)),
})

const scaling = (x: number, y: number): Matrix => ({ ...identity, a: x, d: y })

function apply(m: Matrix, x: number, y: number) {
	return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

/**
 * The `transform` functions a canvas draws: the `translate`, `scale`,
 * `rotate` and `skew` families. Any other is a Canvas Issue.
 */
const translatedTransforms = [
	'translate',
	'translateX',
	'translateY',
	'scale',
	'scaleX',
	'scaleY',
	'rotate',
	'skew',
	'skewX',
	'skewY',
] as const

type TranslatedTransform = (typeof translatedTransforms)[number]

/** Whether `name` is a `transform` function a canvas draws. */
export const isTranslatedTransform = (
	name: string,
): name is TranslatedTransform =>
	(translatedTransforms as readonly string[]).includes(name)

/**
 * One function of a CSS `transform`, or nothing for one whose arguments it
 * can't read.
 */
function transformFunction(
	name: TranslatedTransform,
	args: string[],
	width: number,
	height: number,
): Matrix | undefined {
	const [first, second] = args
	const number = (value = '') => (value === '' ? undefined : Number(value))
	switch (name) {
		case 'translate': {
			const x = length(first, width)
			const y = second === undefined ? 0 : length(second, height)
			return x === undefined || y === undefined ? undefined : translation(x, y)
		}
		case 'translateX': {
			const x = length(first, width)
			return x === undefined ? undefined : translation(x, 0)
		}
		case 'translateY': {
			const y = length(first, height)
			return y === undefined ? undefined : translation(0, y)
		}
		case 'scale': {
			const x = number(first)
			return x === undefined ? undefined : scaling(x, number(second) ?? x)
		}
		case 'scaleX': {
			const x = number(first)
			return x === undefined ? undefined : scaling(x, 1)
		}
		case 'scaleY': {
			const y = number(first)
			return y === undefined ? undefined : scaling(1, y)
		}
		case 'rotate': {
			const degrees = angle(first)
			return degrees === undefined ? undefined : rotation(degrees)
		}
		case 'skew': {
			const x = angle(first)
			const y = second === undefined ? 0 : angle(second)
			return x === undefined || y === undefined ? undefined : skewing(x, y)
		}
		case 'skewX': {
			const x = angle(first)
			return x === undefined ? undefined : skewing(x, 0)
		}
		case 'skewY': {
			const y = angle(first)
			return y === undefined ? undefined : skewing(0, y)
		}
	}
}

/**
 * A CSS `transform`, its functions applied as CSS applies them. Functions it
 * doesn't know, or can't read the arguments of, are left out rather than
 * throwing the rest away, and listed in `unsupported`.
 */
function parseTransform(value: string, width: number, height: number) {
	let matrix = identity
	const unsupported: string[] = []
	for (const [, name, args] of value.matchAll(
		/([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\)/g,
	)) {
		const parts = args
			.split(/[\s,]+/)
			.map((arg) => arg.trim())
			.filter(Boolean)
		const step = isTranslatedTransform(name)
			? transformFunction(name, parts, width, height)
			: undefined
		if (step) matrix = multiply(matrix, step)
		else unsupported.push(name)
	}
	return { matrix, unsupported }
}

/**
 * The functions in a `transform` that a Sprite's transform leaves out, such
 * as `matrix` and the 3D ones, which are Canvas Issues.
 */
export function unsupportedTransforms(value: unknown): string[] {
	// Its size makes no difference to whether a function can be read
	return typeof value === 'string'
		? parseTransform(value, 1, 1).unsupported
		: []
}

const originKeywords: Record<string, number> = {
	left: 0,
	top: 0,
	center: 0.5,
	right: 1,
	bottom: 1,
}

/**
 * A `transform-origin`, as CSS reads it: one or two of lengths, percentages
 * and keywords, in either order where the keywords say which is which.
 * Anything else leaves the origin as it was.
 */
function parseOrigin(
	value: string,
	width: number,
	height: number,
): Vector | undefined {
	let [first, second = 'center'] = value.trim().split(/\s+/)
	if (
		first === 'top' ||
		first === 'bottom' ||
		second === 'left' ||
		second === 'right'
	) {
		;[first, second] = [second, first]
	}
	const x =
		first in originKeywords
			? originKeywords[first] * width
			: length(first, width)
	const y =
		second in originKeywords
			? originKeywords[second] * height
			: length(second, height)
	return x === undefined || y === undefined ? undefined : { x, y }
}

/**
 * The separate `translate` property, as CSS reads it: `none`, or an x and
 * maybe a y, each a length or a percentage. A z is left out, since a canvas
 * is flat. Anything else is undefined.
 */
function parseTranslate(
	value: string,
	width: number,
	height: number,
): Vector | undefined {
	if (value.trim() === 'none') return { x: 0, y: 0 }
	const [first, second = '0'] = value.trim().split(/\s+/)
	const x = length(first, width)
	const y = length(second, height)
	return x === undefined || y === undefined ? undefined : { x, y }
}

/**
 * The keys of a style that place its Sprite, `translate` and
 * `transform-origin`, whose values can't be read, which are Canvas Issues.
 */
export function unreadablePlacement(
	style: Record<string, unknown>,
): ('translate' | 'transform-origin')[] {
	const readers = { translate: parseTranslate, 'transform-origin': parseOrigin }
	return (['translate', 'transform-origin'] as const).filter((key) => {
		const value = style[key]
		if (absent(value)) return false
		// Its size makes no difference to whether it can be read
		return typeof value !== 'string' || !readers[key](value, 1, 1)
	})
}

/**
 * How far parallax leaves a Controller from where its x and y say. With no
 * parallax (1) it moves with the scene. With less, the camera moves it less
 * than the rest, so against the scene it drifts along with the camera, by
 * `1 - parallax` of however far the camera has gone. Attached Controllers move
 * with whatever carries them, so their own parallax doesn't count.
 */
function parallaxOffset(controller: AnyController, parallax: number) {
	const camera = controller.data.scene?.canvas.get()
	if (!camera || parallax === 1) return { x: 0, y: 0 }
	return {
		x: camera.x() * (1 - parallax),
		y: camera.y() * (1 - parallax),
	}
}

/**
 * Where a Controller's Sprite is drawn: the transform from its own box,
 * (0, 0) to (width, height), to the scene's coordinates. Those are what the
 * Renderers' pointer handlers give, the camera's position added to where on
 * the Renderer the pointer is. To paint on the screen, move this by minus
 * the camera's position.
 */
export function spriteTransform(controller: AnyController): Matrix {
	const sprite = controller.sprite()
	const carrier = controller.carrier()
	const { width, height } = sprite
	const style = sprite.style ?? {}
	// The DOM Sprite turns about its `origin`, or its middle without one,
	// unless its style says otherwise.
	const origin = (typeof style['transform-origin'] === 'string' &&
		parseOrigin(style['transform-origin'], width, height)) ||
		sprite.origin || { x: width / 2, y: height / 2 }
	// The DOM Sprite flips and scales with `transform`, so a `transform` in
	// its style takes the place of those, just as it does on the page.
	const transform =
		typeof style.transform === 'string'
			? parseTransform(style.transform, width, height).matrix
			: scaling(sprite.xScale ?? 1, sprite.yScale ?? 1)
	// The separate `translate` property moves it on the screen, outside its
	// rotation, as CSS has it.
	const move = (typeof style.translate === 'string' &&
		parseTranslate(style.translate, width, height)) || { x: 0, y: 0 }
	const shift = carrier
		? { x: 0, y: 0 }
		: parallaxOffset(controller, sprite.parallax ?? 1)
	const local = [
		translation(sprite.x + shift.x, sprite.y + shift.y),
		translation(move.x, move.y),
		translation(origin.x, origin.y),
		rotation(sprite.rotation ?? 0),
		transform,
		translation(-origin.x, -origin.y),
	].reduce(multiply)
	return carrier ? multiply(spriteTransform(carrier), local) : local
}

/** The axis-aligned box around where a Controller's Sprite is drawn. */
export function drawnBox(controller: AnyController): Rect {
	const { width, height } = controller.sprite()
	return boxAround(spriteTransform(controller), width, height)
}

/**
 * The axis-aligned box around the box (0, 0) to (width, height) moved by
 * `m`: `drawnBox`, for a caller that has the transform already. With
 * `reach`, around that box grown by it, side by side, before it's moved.
 */
export function boxAround(
	m: Matrix,
	width: number,
	height: number,
	reach: Reach = { left: 0, top: 0, right: 0, bottom: 0 },
): Rect {
	const left = -reach.left
	const top = -reach.top
	const right = width + reach.right
	const bottom = height + reach.bottom
	const corners = [
		apply(m, left, top),
		apply(m, right, top),
		apply(m, left, bottom),
		apply(m, right, bottom),
	]
	const xs = corners.map((p) => p.x)
	const ys = corners.map((p) => p.y)
	const x = Math.min(...xs)
	const y = Math.min(...ys)
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
