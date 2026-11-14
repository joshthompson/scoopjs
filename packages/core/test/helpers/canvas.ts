/**
 * Seam 2: what the Canvas Renderer paints. jsdom has no canvas, so these
 * stand in for the parts of the browser it paints with: a 2D context that
 * records everything done to it, images a test says have loaded, and display
 * frames a test runs one at a time.
 *
 * The recording context keeps the state a canvas would (its transform, alpha,
 * filter, shadow and so on, through `save` and `restore`), so a test can ask
 * what each image was drawn with rather than replaying the calls itself. To
 * follow another property, add it to `State` and `initialState`; to follow
 * another method that changes the transform, add it to `transforms`.
 */
import { vi } from 'vitest'
import type { ImageLoader } from '../../src/canvasPainter'
import type { Matrix } from '../../src/geometry'

/** One thing done to the context: a method called or a property set. */
export type Call =
	| { method: string; args: unknown[] }
	| { property: string; value: unknown }

/** The context's state that drawing depends on. */
export interface State {
	transform: Matrix
	globalAlpha: number
	filter: string
	shadowColor: string
	shadowBlur: number
	shadowOffsetX: number
	shadowOffsetY: number
	imageSmoothingEnabled: boolean
	globalCompositeOperation: string
}

const initialState = (): State => ({
	transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
	globalAlpha: 1,
	filter: 'none',
	shadowColor: 'rgba(0, 0, 0, 0)',
	shadowBlur: 0,
	shadowOffsetX: 0,
	shadowOffsetY: 0,
	imageSmoothingEnabled: true,
	globalCompositeOperation: 'source-over',
})

export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

/** One `drawImage`, whichever of its three forms was used. */
export interface Draw {
	/** The image's URL, as the fake images know it. */
	image: string
	/** The part of the image drawn: all of it unless a source rect was given. */
	source: Rect
	/** Where it went, in the context's coordinates at the time. */
	dest: Rect
	/** The context's state when it was drawn. */
	state: State
}

const multiply = (m: Matrix, n: Matrix): Matrix => ({
	a: m.a * n.a + m.c * n.b,
	b: m.b * n.a + m.d * n.b,
	c: m.a * n.c + m.c * n.d,
	d: m.b * n.c + m.d * n.d,
	e: m.a * n.e + m.c * n.f + m.e,
	f: m.b * n.e + m.d * n.f + m.f,
})

/** How each method that moves the context changes its transform. */
const transforms: Record<string, (m: Matrix, args: number[]) => Matrix> = {
	setTransform: (_, [a, b, c, d, e, f]) => ({ a, b, c, d, e, f }),
	resetTransform: () => initialState().transform,
	transform: (m, [a, b, c, d, e, f]) => multiply(m, { a, b, c, d, e, f }),
	translate: (m, [x, y]) => multiply(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }),
	scale: (m, [x, y]) => multiply(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }),
	rotate: (m, [angle]) =>
		multiply(m, {
			a: Math.cos(angle),
			b: Math.sin(angle),
			c: -Math.sin(angle),
			d: Math.cos(angle),
			e: 0,
			f: 0,
		}),
}

/** A context that records every call and property set, and keeps state. */
export class RecordingContext {
	calls: Call[] = []
	draws: Draw[] = []
	state = initialState()
	private stack: State[] = []

	constructor(readonly canvas: HTMLCanvasElement) {
		// Every property in `State` is recorded when it's set, the transform
		// aside, which only changes through methods.
		for (const property of Object.keys(this.state)) {
			if (property === 'transform') continue
			Object.defineProperty(this, property, {
				get: () => this.state[property as keyof State],
				set: (value) => {
					this.calls.push({ property, value })
					;(this.state as unknown as Record<string, unknown>)[property] = value
				},
			})
		}
	}

	/** Forgets what's been done so far, but keeps the state it left. */
	reset() {
		this.calls = []
		this.draws = []
	}

	/** The names of the methods called, in order. */
	methods() {
		return this.calls.flatMap((call) => ('method' in call ? call.method : []))
	}

	record(method: string, args: unknown[]) {
		this.calls.push({ method, args })
		const move = transforms[method]
		if (move)
			this.state.transform = move(this.state.transform, args as number[])
	}

	save() {
		this.record('save', [])
		this.stack.push({ ...this.state })
	}

	restore() {
		this.record('restore', [])
		this.state = this.stack.pop() ?? this.state
	}

	setTransform(...args: number[]) {
		this.record('setTransform', args)
	}

	transform(...args: number[]) {
		this.record('transform', args)
	}

	clearRect(...args: number[]) {
		this.record('clearRect', args)
	}

	drawImage(drawn: CanvasImageSource, ...args: number[]) {
		this.record('drawImage', [drawn, ...args])
		const image = drawn as unknown as FakeImage
		const all = { x: 0, y: 0, width: image.width, height: image.height }
		const rect = ([x, y, width, height]: number[]) => ({ x, y, width, height })
		const [source, dest] =
			args.length === 8
				? [rect(args.slice(0, 4)), rect(args.slice(4))]
				: args.length === 4
					? [all, rect(args)]
					: [all, { ...all, x: args[0], y: args[1] }]
		this.draws.push({
			image: image.src,
			source,
			dest,
			state: { ...this.state },
		})
	}
}

/**
 * A recording context for `canvas`. Any method a canvas has that it doesn't
 * know yet is still recorded, so painting with it doesn't throw.
 */
export function createRecordingContext(canvas: HTMLCanvasElement) {
	const context = new RecordingContext(canvas)
	return new Proxy(context, {
		get(target, key, receiver) {
			if (typeof key !== 'string' || key in target) {
				return Reflect.get(target, key, receiver)
			}
			return (...args: unknown[]) => target.record(key, args)
		},
	})
}

/**
 * Makes every `<canvas>` hand out a recording context, until the test ends.
 * Gives back the contexts handed out so far, newest last.
 */
export function recordCanvases() {
	const contexts: RecordingContext[] = []
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		function (this: HTMLCanvasElement) {
			const context = createRecordingContext(this)
			contexts.push(context)
			return context
		} as unknown as typeof HTMLCanvasElement.prototype.getContext,
	)
	return contexts
}

/** An image as the fake loader hands it over, with its natural size. */
export interface FakeImage {
	src: string
	width: number
	height: number
}

/**
 * Images that load when a test says so. Pass `loader` to the painter, then
 * `load(url, width, height)` to say an image has loaded at that natural size,
 * before or after the painter asks for it.
 */
export function fakeImages() {
	const loaded = new Map<string, FakeImage>()
	const waiting = new Map<string, ((image: FakeImage) => void)[]>()
	const requested: string[] = []
	const loader: ImageLoader = (url, onLoad) => {
		requested.push(url)
		const done = (image: FakeImage) =>
			onLoad({
				image: image as unknown as CanvasImageSource,
				width: image.width,
				height: image.height,
			})
		const image = loaded.get(url)
		if (image) return done(image)
		waiting.set(url, [...(waiting.get(url) ?? []), done])
	}
	return {
		loader,
		/** Every URL the painter has asked to load, in order. */
		requested,
		load(url: string, width: number, height: number) {
			const image = { src: url, width, height }
			loaded.set(url, image)
			for (const done of waiting.get(url) ?? []) done(image)
			waiting.delete(url)
		},
	}
}

/**
 * Display frames that only come when a test runs one. Fake timers would run
 * them on a 16ms clock of their own, out of step with the Scene's ticks.
 */
export function stubAnimationFrames() {
	let next = 1
	let callbacks = new Map<number, FrameRequestCallback>()
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		callbacks.set(next, callback)
		return next++
	})
	vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
	return {
		/** How many callbacks are waiting for the next display frame. */
		pending: () => callbacks.size,
		/** Runs one display frame: every callback asked for before it. */
		run(now = performance.now()) {
			const running = callbacks
			callbacks = new Map()
			for (const callback of running.values()) callback(now)
		},
	}
}
