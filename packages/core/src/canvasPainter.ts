import { type Accessor, createEffect, createRoot } from 'solid-js'
import type { Controller } from './Controller'
import type { Scene } from './Scene'
import { drawOrder } from './drawOrder'
import { boxAround, spriteTransform } from './geometry'
import type { Rect } from './types'

// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
type AnyController = Controller<any>

/** An image ready to paint, with its natural size. */
export interface LoadedImage {
	image: CanvasImageSource
	width: number
	height: number
}

/**
 * Loads the image at `url`, and calls `onLoad` once it has, maybe straight
 * away. An image that never loads paints nothing.
 */
export type ImageLoader = (
	url: string,
	onLoad: (loaded: LoadedImage) => void,
) => void

export interface CanvasPainterOptions {
	scene: Scene
	canvas: HTMLCanvasElement
	/** Turns image smoothing off, for pixel art. */
	pixelated?: Accessor<boolean>
	/** How images load: the browser's own way unless a test says otherwise. */
	loadImage?: ImageLoader
}

/** Loads an image as the page would, with an `<img>`. */
const loadWithImg: ImageLoader = (url, onLoad) => {
	const img = new Image()
	img.decoding = 'async'
	img.onload = () =>
		onLoad({ image: img, width: img.naturalWidth, height: img.naturalHeight })
	img.src = url
}

/** `n` modulo `m`, never negative, as a repeating background wraps. */
const wrap = (n: number, m: number) => ((n % m) + m) % m

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
	// Where the copy of the sheet that covers the box's top left corner starts
	const firstX = wrap(left, sheetWidth) - (wrap(left, sheetWidth) && sheetWidth)
	const firstY =
		wrap(top, sheetHeight) - (wrap(top, sheetHeight) && sheetHeight)
	for (let y = firstY; y < height; y += sheetHeight) {
		const y0 = Math.max(y, 0)
		const y1 = Math.min(y + sheetHeight, height)
		for (let x = firstX; x < width; x += sheetWidth) {
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

	// Each image is loaded once, the first time a Sprite shows it, and is
	// undefined until it has.
	const images = new Map<string, { loaded?: LoadedImage }>()
	const image = (url: string) => {
		let entry = images.get(url)
		if (!entry) {
			const created: { loaded?: LoadedImage } = {}
			entry = created
			images.set(url, created)
			loadImage(url, (loaded) => {
				created.loaded = loaded
				invalidate()
			})
		}
		return entry.loaded
	}

	/** Paints one Controller's Sprite into its own box, (0, 0) to its size. */
	const paintSprite = (context: CanvasRenderingContext2D, c: AnyController) => {
		const sprite = c.sprite()
		const frame = sprite.frames[c.currentFrame()]
		if (frame === undefined) return
		const [url] = frame.split('#')
		const loaded = image(scene.resolveAsset(url))
		if (!loaded) return
		// `inner.rotation` turns only the Frame, not the box or the parts
		// attached to it, about `inner.origin` or the middle, as the DOM
		// Sprite's inner element does.
		const { rotation, origin } = sprite.inner ?? {}
		if (rotation) {
			const { x, y } = origin ?? { x: sprite.width / 2, y: sprite.height / 2 }
			context.translate(x, y)
			context.rotate((rotation * Math.PI) / 180)
			context.translate(-x, -y)
		}
		paintFrame(context, loaded, frame, sprite.width, sprite.height)
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
		context.setTransform(
			density,
			0,
			0,
			density,
			-view.x * density,
			-view.y * density,
		)
		context.transform(m.a, m.b, m.c, m.d, m.e, m.f)
		paintSprite(context, controller)
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

	// What counts as a change. A Tick, and a Ticker, which runs every Tick
	// even while the Scene's paused, so a game's own Tickers are covered too.
	scene.tickers.add(invalidate)
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
			scene.tickers.delete(invalidate)
			if (frameRequest !== undefined) cancelAnimationFrame(frameRequest)
		},
	}
}
