import type { LoadedImage } from './canvasPainter'
import type { Matrix } from './geometry'
import type { CanvasStyle, ColourFilter } from './styleTranslator'

/** A colour filter as the context's own `filter` takes it. */
function cssFilter({ name, amount }: ColourFilter) {
	return name === 'hue-rotate' ? `${name}(${amount}deg)` : `${name}(${amount})`
}

/**
 * A colour filter rounded, so that one animating doesn't recolour a Frame
 * every Tick: to a whole degree for `hue-rotate`, and to 0.01 for the rest.
 */
function rounded({ name, amount }: ColourFilter): ColourFilter {
	const round = name === 'hue-rotate' ? 1 : 100
	return { name, amount: Math.round(amount * round) / round }
}

/** A 3×3 matrix taking a pixel's red, green and blue to new ones. */
type ColourMatrix = [number, number, number][]

/**
 * The matrix for a colour filter, as the Filter Effects spec gives them,
 * worked on red, green and blue as they are, without a linear colour space,
 * as CSS's filter functions are.
 */
function colourMatrix({ name, amount }: ColourFilter): ColourMatrix {
	switch (name) {
		case 'brightness':
			return [
				[amount, 0, 0],
				[0, amount, 0],
				[0, 0, amount],
			]
		case 'saturate': {
			const s = amount
			return [
				[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
				[0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
				[0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
			]
		}
		case 'sepia': {
			const s = 1 - amount
			return [
				[0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s],
				[0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s],
				[0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s],
			]
		}
		case 'hue-rotate': {
			const cos = Math.cos((amount * Math.PI) / 180)
			const sin = Math.sin((amount * Math.PI) / 180)
			return [
				[
					0.213 + cos * 0.787 - sin * 0.213,
					0.715 - cos * 0.715 - sin * 0.715,
					0.072 - cos * 0.072 + sin * 0.928,
				],
				[
					0.213 - cos * 0.213 + sin * 0.143,
					0.715 + cos * 0.285 + sin * 0.14,
					0.072 - cos * 0.072 - sin * 0.283,
				],
				[
					0.213 - cos * 0.213 - sin * 0.787,
					0.715 - cos * 0.715 + sin * 0.715,
					0.072 + cos * 0.928 + sin * 0.072,
				],
			]
		}
	}
}

const clamp = (n: number) => Math.min(255, Math.max(0, n))

/**
 * Recolours pixels in place, one filter after another. Each step's colours
 * are clamped before the next, as a page's are between filter functions.
 */
function recolourPixels(pixels: Uint8ClampedArray, filters: ColourFilter[]) {
	const matrices = filters.map(colourMatrix)
	for (let i = 0; i < pixels.length; i += 4) {
		let r = pixels[i]
		let g = pixels[i + 1]
		let b = pixels[i + 2]
		for (const [red, green, blue] of matrices) {
			;[r, g, b] = [
				clamp(red[0] * r + red[1] * g + red[2] * b),
				clamp(green[0] * r + green[1] * g + green[2] * b),
				clamp(blue[0] * r + blue[1] * g + blue[2] * b),
			]
		}
		pixels[i] = r
		pixels[i + 1] = g
		pixels[i + 2] = b
	}
}

/**
 * A copy of an image with its colours filtered, or the image itself when it
 * can't be read, as one from another site without CORS can't.
 */
function recolour(loaded: LoadedImage, filters: ColourFilter[]): LoadedImage {
	const { width, height } = loaded
	if (!(width > 0 && height > 0)) return loaded
	const copy = document.createElement('canvas')
	copy.width = width
	copy.height = height
	const context = copy.getContext('2d', { willReadFrequently: true })
	if (!context) return loaded
	context.drawImage(loaded.image, 0, 0, width, height)
	try {
		const pixels = context.getImageData(0, 0, width, height)
		recolourPixels(pixels.data, filters)
		context.putImageData(pixels, 0, 0)
	} catch {
		return loaded
	}
	return { image: copy, width, height }
}

// How many recoloured images are kept. An animated filter makes a new one for
// each value it rounds to, and the ones it's moved on from go first.
const keptCopies = 256

/**
 * Puts a Controller's style onto a context, for painting it: its alpha,
 * filter and shadow. Where the context has no `filter`, the colour filters
 * are drawn by recolouring each image instead, once for each rounded value.
 */
export function createFilterApplier(context: CanvasRenderingContext2D) {
	// Asked once. Where a context has no `filter` of its own, as WebKit's
	// hasn't, it's not a string.
	const native = typeof context.filter === 'string'
	// The colour filters set last, which a context without `filter` keeps here
	let colours: ColourFilter[] = []
	// Recoloured images by URL and rounded filters, the least recently used
	// first.
	const copies = new Map<string, LoadedImage>()

	return {
		/**
		 * Sets everything a Controller's style says on the context, and resets
		 * what it doesn't say, so nothing is left from the last Controller.
		 * `m` is the Sprite's transform, and `density` the screen's pixels to
		 * one of the Renderer's.
		 */
		apply(style: CanvasStyle, m: Matrix, density: number) {
			context.globalAlpha = style.alpha
			if (native) {
				context.filter = style.colours.length
					? style.colours.map(cssFilter).join(' ')
					: 'none'
			} else {
				colours = style.colours.map(rounded)
			}
			// A canvas's shadow isn't moved by its transform, so it's put
			// where the transform would have taken it, as a page's is.
			const { shadow } = style
			const { x = 0, y = 0, blur = 0 } = shadow ?? {}
			context.shadowColor = shadow?.colour ?? 'rgba(0, 0, 0, 0)'
			context.shadowOffsetX = density * (m.a * x + m.c * y)
			context.shadowOffsetY = density * (m.b * x + m.d * y)
			context.shadowBlur =
				density * blur * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))
		},

		/**
		 * The image at `url` as it should be painted with the colour filters
		 * set last: itself where the context draws them, or else a copy
		 * recoloured.
		 */
		image(url: string, loaded: LoadedImage): LoadedImage {
			if (native || colours.length === 0) return loaded
			const key = `${url} ${colours.map(cssFilter).join(' ')}`
			const kept = copies.get(key)
			copies.delete(key)
			const copy = kept ?? recolour(loaded, colours)
			copies.set(key, copy)
			if (copies.size > keptCopies) {
				copies.delete(copies.keys().next().value as string)
			}
			return copy
		},
	}
}
