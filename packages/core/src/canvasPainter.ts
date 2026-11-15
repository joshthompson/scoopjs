import {
	type Accessor,
	createEffect,
	createRoot,
	onCleanup,
	untrack,
} from 'solid-js'
import type { AnyController } from './Controller'
import type { Scene } from './Scene'
import {
	mountWithoutElement,
	reportControllerIssues,
	reportMissingImage,
	reportSceneIssues,
} from './canvasIssues'
import { drawOrder } from './drawOrder'
import { createFilterApplier } from './filterApplier'
import { type ParsedFrame, parseFrame } from './frames'
import { boxAround, spriteTransform } from './geometry'
import { effectiveStyle } from './styleTranslator'
import type { Rect } from './types'

/** An image ready to paint, with its natural size. */
export interface LoadedImage {
	image: CanvasImageSource
	width: number
	height: number
}

/**
 * Loads the image at `url`, and calls `onLoad` once it has, maybe straight
 * away, or `onError` if it can't. An image that never loads paints nothing.
 */
export type ImageLoader = (
	url: string,
	onLoad: (loaded: LoadedImage) => void,
	onError?: () => void,
) => void

export interface CanvasPainterOptions {
	scene: Scene
	canvas: HTMLCanvasElement
	/**
	 * Turns image smoothing off for every Sprite, for pixel art. A Sprite can
	 * turn it off for itself with `image-rendering` in its style.
	 */
	pixelated?: Accessor<boolean>
	/** How images load: the browser's own way unless a test says otherwise. */
	loadImage?: ImageLoader
}

// Every painter's own Ticker, which are no reason for another to repaint
const painterTicks = new WeakSet<() => void>()

// The most pixels a backing store has. iOS won't make one canvas bigger than
// 16,777,216 (4096²), and paints nothing at all on one that asks for more, so
// a Renderer that would need more is painted at a lower density: a little
// soft, but there.
export const maxBackingArea = 16_000_000
// Nor is it wider or taller than this, which every browser allows
const maxBackingSide = 16_384
// How far the canvas's size on the screen can move from the backing store's
// before it's resized at once: by a fifth, bigger or smaller...
const resizeRatio = 1.2
// ...and how long a smaller move has to stay put before it's resized. A zoom
// animated with `scale()` moves it every display frame, and each resize
// reallocates the canvas and clears it, so it's resized once the zoom's done.
export const settleMs = 250

/** Loads an image as the page would, with an `<img>`. */
const loadWithImg: ImageLoader = (url, onLoad, onError) => {
	const img = new Image()
	img.decoding = 'async'
	img.onload = () =>
		onLoad({ image: img, width: img.naturalWidth, height: img.naturalHeight })
	img.onerror = () => onError?.()
	img.src = url
}

/**
 * Where the copy of a repeating background that covers 0 starts, for one
 * moved by `offset` and repeating every `size`: at 0 or before it.
 */
function firstCopy(offset: number, size: number) {
	const into = ((offset % size) + size) % size
	return into === 0 ? 0 : into - size
}

/**
 * Paints a Frame into the box (0, 0) to (width, height), as the DOM Sprite
 * shows it as a CSS background. A `url#x,y,w,h` Frame is a crop of a sprite
 * sheet: the sheet is scaled so its height is the Sprite's, then moved by x
 * and y in display pixels, repeating in both directions so offsets wrap round
 * it. Any other Frame is the whole image stretched to the box. Each piece of
 * the sheet that lands in the box is drawn on its own, so nothing is drawn
 * outside it.
 */
function paintFrame(
	context: CanvasRenderingContext2D,
	loaded: LoadedImage,
	frame: ParsedFrame,
	width: number,
	height: number,
) {
	const { x: left, y: top, width: cropWidth, height: cropHeight } = frame
	const cropped = !!cropWidth && !!cropHeight
	const sheetHeight = height
	const sheetWidth = cropped ? (loaded.width * height) / loaded.height : width
	if (!(sheetWidth > 0 && sheetHeight > 0)) return
	const scaleX = loaded.width / sheetWidth
	const scaleY = loaded.height / sheetHeight
	for (let y = firstCopy(top, sheetHeight); y < height; y += sheetHeight) {
		const y0 = Math.max(y, 0)
		const y1 = Math.min(y + sheetHeight, height)
		for (let x = firstCopy(left, sheetWidth); x < width; x += sheetWidth) {
			const x0 = Math.max(x, 0)
			const x1 = Math.min(x + sheetWidth, width)
			context.drawImage(
				loaded.image,
				(x0 - x) * scaleX,
				(y0 - y) * scaleY,
				(x1 - x0) * scaleX,
				(y1 - y0) * scaleY,
				x0,
				y0,
				x1 - x0,
				y1 - y0,
			)
		}
	}
}

/**
 * Everything the Canvas Renderer does but put a `<canvas>` on the page: it
 * paints a Scene onto one, every display frame something changed, until it's
 * disposed of.
 */
export function createCanvasPainter(options: CanvasPainterOptions) {
	const { scene, canvas } = options
	const loadImage = options.loadImage ?? loadWithImg
	const ctx = canvas.getContext('2d')
	const filters = ctx && createFilterApplier(ctx)
	reportSceneIssues(scene)

	// Each image is loaded once, the first time a Sprite shows it, and is
	// undefined until it has. One that can't be loaded is a Canvas Issue for
	// each type of Controller that shows it.
	type Entry = { loaded?: LoadedImage; failed?: boolean }
	const images = new Map<string, Entry>()
	const image = (url: string, shownBy: AnyController) => {
		let entry = images.get(url)
		if (!entry) {
			const created: Entry = {}
			entry = created
			images.set(url, created)
			loadImage(
				url,
				(loaded) => {
					created.loaded = loaded
					invalidate()
				},
				() => {
					created.failed = true
					reportMissingImage(scene, shownBy, url)
				},
			)
		}
		if (entry.failed) reportMissingImage(scene, shownBy, url)
		return entry.loaded
	}

	/**
	 * Paints a Controller's current Frame into its Sprite's own box, (0, 0) to
	 * its size, leaving the context as it found it.
	 */
	const paintCurrentFrame = (
		context: CanvasRenderingContext2D,
		controller: AnyController,
	) => {
		const sprite = controller.sprite()
		const written = sprite.frames[controller.currentFrame()]
		if (written === undefined) return
		const frame = parseFrame(written)
		const resolved = scene.resolveAsset(frame.url)
		const original = image(resolved, controller)
		if (!original) return
		// Recoloured by the style's filter, where the context can't do it
		const loaded = filters?.image(resolved, original) ?? original
		// `inner.rotation` turns only the Frame, not the box or the parts
		// attached to it, about `inner.origin` or the middle, as the DOM
		// Sprite's inner element does.
		const { rotation, origin } = sprite.inner ?? {}
		if (!rotation) {
			paintFrame(context, loaded, frame, sprite.width, sprite.height)
			return
		}
		const { x, y } = origin ?? { x: sprite.width / 2, y: sprite.height / 2 }
		context.save()
		context.translate(x, y)
		context.rotate((rotation * Math.PI) / 180)
		context.translate(-x, -y)
		paintFrame(context, loaded, frame, sprite.width, sprite.height)
		context.restore()
	}

	// The backing store is the canvas's size on the screen, in the screen's own
	// pixels: its CSS size, which is the Renderer's, times every transform
	// scaling it or anything it's in, times `devicePixelRatio`. The browser
	// then shows it pixel for pixel, rather than stretching it, which blurs
	// Sprites and spreads pixel art's rows of pixels unevenly. Everything is
	// painted in the Renderer's pixels, scaled by `density`: the backing
	// store's pixels to one of the Renderer's.
	let density = 1
	// The canvas's CSS size, and how much CSS scales it, as last measured
	let size = { width: 0, height: 0 }
	let cssScale = 1
	// The screen's density when the backing store was last fitted
	let screenDensity = 0
	// Whether the backing store has to fit the screen exactly, and at once:
	// when it's new, or the Renderer's size or the screen's density changed
	let exact = true

	/**
	 * How much CSS scales the canvas on the screen, from the box around it,
	 * which takes in the transforms on everything it's in, as a
	 * ResizeObserver's sizes don't. The box around a turned canvas is bigger
	 * than it is, so a turned Renderer gets more pixels than it needs, never
	 * fewer: it's rare enough not to matter. A canvas that isn't on the page,
	 * or isn't shown, keeps the scale it had.
	 */
	const measureScale = () => {
		const box = canvas.getBoundingClientRect()
		const scale = Math.max(box.width / size.width, box.height / size.height)
		if (scale > 0 && Number.isFinite(scale)) cssScale = scale
	}

	// A small move in the size on the screen, waiting to be resized to until
	// it's stayed put for `settleMs`
	let settling:
		| { width: number; height: number; settled: boolean; timer: number }
		| undefined
	const stopSettling = () => {
		if (settling) clearTimeout(settling.timer)
		settling = undefined
	}
	/** Whether the backing store's size on the screen has settled at this. */
	const settledAt = (width: number, height: number) => {
		if (settling?.width === width && settling.height === height) {
			return settling.settled
		}
		stopSettling()
		const next = { width, height, settled: false, timer: 0 }
		next.timer = window.setTimeout(() => {
			next.settled = true
			invalidate()
		}, settleMs)
		settling = next
		return false
	}

	/**
	 * Resizes the backing store to the canvas's size on the screen, if it
	 * should be, as each paint starts.
	 *
	 * It's measured every time, since a transform can change at any time and
	 * nothing reliably says it has: what's watched below only catches the
	 * usual ways, to repaint a Scene that's still. That's at most once a
	 * display frame, and only when something's changed. Measuring lays the
	 * page out, if something's changed it since it last was, but that's the
	 * layout the browser would do anyway before showing this display frame:
	 * nothing after it here changes the page, so it's done sooner, not twice.
	 */
	const fit = () => {
		const screen = window.devicePixelRatio || 1
		if (screen !== screenDensity) {
			screenDensity = screen
			exact = true
			watchScreenDensity()
		}
		measureScale()
		const { width: cssWidth, height: cssHeight } = size
		const wanted = Math.min(
			screen * cssScale,
			Math.sqrt(maxBackingArea / (cssWidth * cssHeight)),
			maxBackingSide / cssWidth,
			maxBackingSide / cssHeight,
		)
		let width = Math.round(cssWidth * wanted)
		let height = Math.round(cssHeight * wanted)
		// Rounded down where rounding would take it over a limit
		if (
			width * height > maxBackingArea ||
			Math.max(width, height) > maxBackingSide
		) {
			width = Math.floor(cssWidth * wanted)
			height = Math.floor(cssHeight * wanted)
		}
		if (!exact && width === canvas.width && height === canvas.height) {
			stopSettling()
			return
		}
		const far = wanted > density * resizeRatio || wanted < density / resizeRatio
		if (!(exact || far || settledAt(width, height))) return
		exact = false
		stopSettling()
		density = wanted
		// Only set when it's changed, since setting it clears the canvas
		if (canvas.width !== width) canvas.width = width
		if (canvas.height !== height) canvas.height = height
	}

	// The screen's density changes when the page is zoomed or moved to
	// another screen, which a media query for the density it has now says.
	let densityQuery: MediaQueryList | undefined
	const watchScreenDensity = () => {
		densityQuery?.removeEventListener('change', invalidate)
		densityQuery = window.matchMedia?.(`(resolution: ${screenDensity}dppx)`)
		densityQuery?.addEventListener('change', invalidate)
	}

	// A transform on anything the canvas is in changing while nothing in the
	// Scene moves, as a zoom while the Scene's paused would, which wouldn't
	// repaint it otherwise. Their style and class are watched, from when the
	// canvas is first painted on the page, which is where a game scales it.
	const transformWatch = new MutationObserver(() => invalidate())
	let watchingTransforms = false
	const watchTransforms = () => {
		if (watchingTransforms || !canvas.isConnected) return
		watchingTransforms = true
		for (let el = canvas.parentElement; el; el = el.parentElement) {
			transformWatch.observe(el, {
				attributes: true,
				attributeFilter: ['style', 'class'],
			})
		}
	}
	// One animated by CSS, once it's finished: till then, the browser
	// stretches what was painted last.
	const afterAnimation = (event: Event) => {
		if (event.target instanceof Node && event.target.contains(canvas)) {
			invalidate()
		}
	}

	const paint = () => {
		if (!ctx) return
		watchTransforms()
		fit()
		const camera = scene.canvas.get()
		const cameraRect = {
			x: camera.x(),
			y: camera.y(),
			width: camera.width(),
			height: camera.height(),
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		const pixelated = !!options.pixelated?.()
		for (const controller of drawOrder(scene)) {
			paintController(ctx, controller, cameraRect, pixelated)
		}
	}

	/**
	 * Paints one Controller, unless it's outside what the camera sees. Each entry in the
	 * draw order carries its whole transform, carriers and all, so it starts
	 * from the camera every time rather than nesting inside its carrier.
	 * `pixelated` is the Renderer's prop, which turns smoothing off for all.
	 */
	const paintController = (
		context: CanvasRenderingContext2D,
		controller: AnyController,
		cameraRect: Rect,
		pixelated: boolean,
	) => {
		const style = effectiveStyle(controller)
		if (style.hidden) return
		const m = spriteTransform(controller)
		// Nothing the camera doesn't see costs anything to paint. Each part is
		// checked on its own, since one can reach out past its carrier.
		// Each part is checked with all its Draw Hook reaches past its box
		const { width, height } = controller.sprite()
		const box = boxAround(m, width, height, controller.drawReach)
		if (
			box.x >= cameraRect.x + cameraRect.width ||
			box.y >= cameraRect.y + cameraRect.height ||
			box.x + box.width <= cameraRect.x ||
			box.y + box.height <= cameraRect.y
		) {
			return
		}
		// Reported the first time it's drawn, and only then: nothing marks it
		reportControllerIssues(scene, controller)
		const smoothed = !(pixelated || style.pixelated)
		// The Sprite's transform, from the camera, in the backing store's pixels
		let x = density * (m.e - cameraRect.x)
		let y = density * (m.f - cameraRect.y)
		// Pixel art that isn't turned or skewed is put on a whole pixel of the
		// backing store, which is one of the screen's. Otherwise the rows of
		// pixels at its edges are blended with what's behind them, and, as it
		// moves, which of its pixels show a screen pixel wider than the rest
		// keeps changing. It's moved half a screen pixel at most, which on a
		// phone is a fraction of one of the Renderer's: too little to show as
		// jitter. A smoothed Sprite isn't moved, as it can show where it is
		// between pixels, and slow movement would step.
		if (!smoothed && m.b === 0 && m.c === 0) {
			x = Math.round(x)
			y = Math.round(y)
		}
		context.setTransform(
			density * m.a,
			density * m.b,
			density * m.c,
			density * m.d,
			x,
			y,
		)
		filters?.apply(style, m, density)
		// Set for every Sprite, so one's `image-rendering` isn't left for the
		// next, and since resizing a canvas resets it. A Draw Hook paints
		// with it too.
		context.imageSmoothingEnabled = smoothed
		paintSprite(context, controller)
	}

	/**
	 * Paints a Controller into its Sprite's box: its current Frame, or
	 * whatever its Draw Hook paints instead. Its Attached Controllers are
	 * entries of their own in the draw order, so they're painted after it
	 * either way.
	 */
	const paintSprite = (
		context: CanvasRenderingContext2D,
		controller: AnyController,
	) => {
		if (!controller.draw) {
			paintCurrentFrame(context, controller)
			return
		}
		// Whatever the hook leaves set on the context isn't left for the next
		context.save()
		try {
			controller.draw({
				ctx: context,
				drawDefault: () => paintCurrentFrame(context, controller),
				image: (url) => image(scene.resolveAsset(url), controller),
				$scene: scene,
			})
		} finally {
			context.restore()
		}
	}

	// A repaint at most once a display frame, and only once something has
	// changed since the last.
	let frameRequest: number | undefined
	// An image that's loaded already says so while it's being painted, which
	// is no reason to paint again.
	let painting = false
	const invalidate = () => {
		if (painting) return
		frameRequest ??= requestAnimationFrame(() => {
			frameRequest = undefined
			painting = true
			try {
				paint()
			} finally {
				painting = false
			}
		})
	}

	// What counts as a change. A Tick in which the Controllers moved, and the
	// paused one after them, since what paused the Scene may have moved them
	// too. A paused Tick otherwise only changes something if the game runs
	// something of its own in it: its own Tickers or `afterEnterFrames`. A
	// still Scene then doesn't repaint at all, which saves a phone's battery.
	let movedLastTick = true
	const tick = () => {
		const moved = scene.isActive()
		if (moved || movedLastTick || gameRunsWhilePaused()) invalidate()
		movedLastTick = moved
	}
	const gameRunsWhilePaused = () => {
		if (scene.options.afterEnterFrames) return true
		for (const ticker of scene.tickers) {
			if (!painterTicks.has(ticker)) return true
		}
		return false
	}
	painterTicks.add(tick)
	scene.tickers.add(tick)
	const disposeEffects = createRoot((dispose) => {
		// The Renderer resizing. The canvas takes its size on the page now, and
		// its backing store fits it exactly as it's next painted.
		createEffect(() => {
			const camera = scene.canvas.get()
			size = { width: camera.width(), height: camera.height() }
			canvas.style.width = `${size.width}px`
			canvas.style.height = `${size.height}px`
			exact = true
			invalidate()
		})
		// Anything that can change the canvas's size on the screen without
		// anything in the Scene changing: the window resizing, which a game
		// scaling its stage to fit it follows, and the rest watched above.
		window.addEventListener('resize', invalidate)
		document.addEventListener('transitionend', afterAnimation)
		document.addEventListener('animationend', afterAnimation)
		onCleanup(() => {
			window.removeEventListener('resize', invalidate)
			document.removeEventListener('transitionend', afterAnimation)
			document.removeEventListener('animationend', afterAnimation)
			densityQuery?.removeEventListener('change', invalidate)
			transformWatch.disconnect()
			stopSettling()
		})
		// Pixel art scaled by CSS, as well as by the painting itself
		createEffect(() => {
			canvas.style.setProperty(
				'image-rendering',
				options.pixelated?.() ? 'pixelated' : '',
			)
			invalidate()
		})
		// The camera moving, between Ticks as well as in them
		createEffect(() => {
			const camera = scene.canvas.get()
			camera.x()
			camera.y()
			invalidate()
		})
		// A web font finishing loading, for text a Draw Hook draws in it: till
		// then, the canvas has drawn it in a fallback font.
		const fonts = typeof document === 'undefined' ? undefined : document.fonts
		fonts?.addEventListener('loadingdone', invalidate)
		onCleanup(() => fonts?.removeEventListener('loadingdone', invalidate))
		// Each Controller's `onMount`, once it's in the Scene, as the DOM
		// Renderer runs it once its Sprite's on the page. One taken out and
		// put back is mounted again, as it would be there.
		let mounted = new Set<AnyController>()
		createEffect(() => {
			const present = new Set(scene.getAllControllers())
			untrack(() => {
				for (const controller of present) {
					if (!mounted.has(controller)) mountWithoutElement(scene, controller)
				}
			})
			mounted = present
		})
		// A Frame stepping, which on the `'display'` frame clock happens
		// between Ticks, and Controllers coming and going
		createEffect(() => {
			for (const controller of scene.getAllControllers()) {
				controller.currentFrame()
			}
			invalidate()
		})
		return dispose
	})

	return {
		dispose() {
			disposeEffects()
			scene.tickers.delete(tick)
			if (frameRequest !== undefined) cancelAnimationFrame(frameRequest)
		},
	}
}
