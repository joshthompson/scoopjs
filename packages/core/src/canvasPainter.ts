import { type Accessor, createEffect, createRoot, untrack } from 'solid-js'
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
import { boxAround, spriteTransform } from './geometry'
import { canvasStyle } from './styleTranslator'
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
	/** Turns image smoothing off, for pixel art. */
	pixelated?: Accessor<boolean>
	/** How images load: the browser's own way unless a test says otherwise. */
	loadImage?: ImageLoader
}

// Every painter's own Ticker, which are no reason for another to repaint
const painterTicks = new WeakSet<() => void>()

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
	frame: string,
	width: number,
	height: number,
) {
	const [left = 0, top = 0, cropWidth, cropHeight] =
		frame.split('#')[1]?.split(',').map(Number) ?? []
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
		c: AnyController,
	) => {
		const sprite = c.sprite()
		const frame = sprite.frames[c.currentFrame()]
		if (frame === undefined) return
		const [url] = frame.split('#')
		const resolved = scene.resolveAsset(url)
		const original = image(resolved, c)
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

	// The backing store is the Renderer's size in the screen's own pixels, so
	// Sprites are sharp on a high-density screen. Everything is painted in
	// the Renderer's pixels, scaled by `density`.
	let density = 1
	const resize = () => {
		const camera = scene.canvas.get()
		const width = camera.width()
		const height = camera.height()
		density = window.devicePixelRatio || 1
		canvas.width = Math.round(width * density)
		canvas.height = Math.round(height * density)
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`
	}

	const paint = () => {
		if (!ctx) return
		// The density changes when the page is zoomed or moved to another
		// screen, which nothing else says: it's a cheap thing to check.
		if ((window.devicePixelRatio || 1) !== density) resize()
		const camera = scene.canvas.get()
		const view = {
			x: camera.x(),
			y: camera.y(),
			width: camera.width(),
			height: camera.height(),
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		// Set every paint, since resizing a canvas resets it
		ctx.imageSmoothingEnabled = !options.pixelated?.()
		for (const controller of drawOrder(scene)) {
			paintController(ctx, controller, view)
		}
	}

	/**
	 * Paints one Controller, unless it's outside the view. Each entry in the
	 * draw order carries its whole transform, carriers and all, so it starts
	 * from the camera every time rather than nesting inside its carrier.
	 */
	const paintController = (
		context: CanvasRenderingContext2D,
		controller: AnyController,
		view: Rect,
	) => {
		const style = canvasStyle(controller)
		if (style.hidden) return
		const m = spriteTransform(controller)
		// Nothing outside the view costs anything to paint. Each part is
		// checked on its own, since one can reach out past its carrier.
		const { width, height } = controller.sprite()
		const box = boxAround(m, width, height)
		if (
			box.x >= view.x + view.width ||
			box.y >= view.y + view.height ||
			box.x + box.width <= view.x ||
			box.y + box.height <= view.y
		) {
			return
		}
		// Reported the first time it's drawn, and only then: nothing marks it
		reportControllerIssues(scene, controller)
		context.setTransform(
			density,
			0,
			0,
			density,
			-view.x * density,
			-view.y * density,
		)
		context.transform(m.a, m.b, m.c, m.d, m.e, m.f)
		filters?.apply(style, m, density)
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
		// The Renderer resizing, which clears the canvas
		createEffect(() => {
			resize()
			invalidate()
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
