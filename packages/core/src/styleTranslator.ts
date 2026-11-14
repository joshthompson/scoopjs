/**
 * The style translator: what the Canvas Renderer makes of a Controller's
 * `style`. `translateStyle` reads one Controller's own style, including what
 * it can't draw, for Canvas Issues. `effectiveStyle` is how a Controller is
 * drawn, with what it inherits from its carriers: what the Canvas Renderer
 * paints with, and the Pointer Pick goes by under either Renderer.
 */
import type { JSX } from 'solid-js'
import type { AnyController } from './Controller'
import { absent, angle, length } from './cssValues'
import { unreadablePlacement, unsupportedTransforms } from './geometry'

/** The `filter` functions that recolour, which a canvas draws. */
const colourFilterNames = [
	'hue-rotate',
	'brightness',
	'sepia',
	'saturate',
] as const

/**
 * One of the `filter` functions that recolour: `hue-rotate` in degrees, the
 * others as a number, 1 being 100%.
 */
export interface ColourFilter {
	name: (typeof colourFilterNames)[number]
	amount: number
}

const isColourFilter = (name: string): name is ColourFilter['name'] =>
	(colourFilterNames as readonly string[]).includes(name)

/** A `drop-shadow`, its offsets and blur in the Sprite's own pixels. */
export interface Shadow {
	x: number
	y: number
	blur: number
	colour: string
}

/** One Controller's own `style`, as far as a canvas can draw it. */
export interface TranslatedStyle {
	/** `opacity`, from 0 to 1. */
	alpha: number
	/**
	 * `visibility`: whether it says it's hidden or visible, or undefined to
	 * take its carrier's, as CSS inherits it.
	 */
	visible: boolean | undefined
	/** `display: none`, which hides everything it carries too. */
	removed: boolean
	/** The colour functions of its `filter`, in order. */
	colours: ColourFilter[]
	/** The first `drop-shadow` in its `filter`: a canvas casts only one. */
	shadow: Shadow | undefined
	/** `z-index`, which orders it among Controllers at its level. */
	zIndex: number
	/**
	 * `image-rendering`: true where it turns image smoothing off, false where
	 * it leaves that to the Renderer, or undefined to take its carrier's, as
	 * CSS inherits it.
	 */
	pixelated: boolean | undefined
	/**
	 * The keys it has that a canvas can't draw, which are Canvas Issues.
	 * Keys left without a value aren't counted, since the page leaves them out.
	 */
	untranslatable: string[]
	/**
	 * The functions in its `filter` that a canvas doesn't draw, which are
	 * Canvas Issues: those outside the supported set, those whose arguments
	 * it can't read, and any `drop-shadow` after the first. Something that
	 * isn't a function at all is listed as it's written.
	 */
	unsupportedFilters: string[]
	/**
	 * The functions in its `transform` that a canvas doesn't draw, which are
	 * Canvas Issues: `matrix`, the 3D ones, and those whose arguments it
	 * can't read.
	 */
	unsupportedTransforms: string[]
	/**
	 * The keys a canvas draws whose values it can't read, such as
	 * `opacity: var(--o)`, which are Canvas Issues: they're drawn as if they
	 * weren't there.
	 */
	unreadable: string[]
}

/** The keys a canvas draws. Every other is a Canvas Issue. */
const translatedKeys = new Set([
	'opacity',
	'visibility',
	'display',
	'z-index',
	// These three are in the Sprite's transform, from `spriteTransform`
	'transform',
	'translate',
	'transform-origin',
	'filter',
	'image-rendering',
])

/**
 * The `image-rendering` values a canvas can reproduce, and whether each
 * turns image smoothing off. `auto` and `smooth` don't turn it on: they
 * leave it to the Renderer's `pixelated` prop, which is for every Sprite.
 */
const pixelatedBy = new Map([
	['pixelated', true],
	['crisp-edges', true],
	['auto', false],
	['smooth', false],
])

/** A CSS number or percentage, or undefined for anything else. */
function amount(value: unknown) {
	if (typeof value === 'number') return value
	if (typeof value !== 'string') return undefined
	const trimmed = value.trim()
	if (trimmed.endsWith('%')) return Number.parseFloat(trimmed) / 100
	const number = Number(trimmed)
	return trimmed === '' || Number.isNaN(number) ? undefined : number
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Each function in a `filter`, with what's in its brackets, and the first
 * word of anything after them that isn't one.
 */
function filterFunctions(value: string) {
	const functions: { name: string; args: string }[] = []
	let unreadable: string | undefined
	let at = 0
	while (at < value.length) {
		const name = value.slice(at).match(/^\s*([a-zA-Z-]+)\(/)
		if (!name) {
			const rest = value.slice(at).trim()
			if (rest !== '' && rest !== 'none') unreadable = rest.split(/\s/)[0]
			break
		}
		at += name[0].length
		// Up to the bracket that closes it, past any inside, as in rgba(...)
		let depth = 1
		const start = at
		for (; at < value.length && depth > 0; at++) {
			if (value[at] === '(') depth++
			if (value[at] === ')') depth--
		}
		functions.push({ name: name[1], args: value.slice(start, at - 1).trim() })
	}
	return { functions, unreadable }
}

/**
 * A colour function as CSS reads it, or undefined for an amount it doesn't
 * allow. No amount is 0deg for `hue-rotate` and 100% for the rest.
 */
function colourFilter(
	name: ColourFilter['name'],
	args: string,
): ColourFilter | undefined {
	if (name === 'hue-rotate') {
		const degrees = args === '' ? 0 : angle(args)
		return degrees === undefined ? undefined : { name, amount: degrees }
	}
	const value = args === '' ? 1 : amount(args)
	if (value === undefined || value < 0) return undefined
	return {
		name,
		// More than 100% sepia is 100%, as CSS has it
		amount: name === 'sepia' ? Math.min(value, 1) : value,
	}
}

/**
 * A `drop-shadow`: two lengths for its offset, maybe a third for its blur,
 * and maybe a colour, before them or after. Anything else is undefined.
 */
function shadow(args: string): Shadow | undefined {
	// Split on spaces outside brackets, so rgba(0, 0, 0, 0.5) stays whole
	const parts = args.match(/[^\s(]+(\([^)]*\))?/g) ?? []
	const lengths: number[] = []
	const colours: string[] = []
	for (const part of parts) {
		// In pixels only: a percentage of nothing
		const pixels = length(part)
		if (pixels === undefined) colours.push(part)
		else lengths.push(pixels)
	}
	if (lengths.length < 2 || lengths.length > 3 || colours.length > 1) {
		return undefined
	}
	const [x, y, blur = 0] = lengths
	// Without a colour the page uses the text colour, which a canvas hasn't
	// got: black is what a page's text is unless it's told otherwise.
	const colour = colours[0] ?? 'black'
	return {
		x,
		y,
		blur,
		colour: colour.toLowerCase() === 'currentcolor' ? 'black' : colour,
	}
}

/** The parts of a `filter` a canvas can draw. */
function translateFilter(value: unknown) {
	const colours: ColourFilter[] = []
	let first: Shadow | undefined
	const unsupportedFilters: string[] = []
	if (typeof value !== 'string') {
		return { colours, shadow: first, unsupportedFilters }
	}
	const { functions, unreadable } = filterFunctions(value)
	for (const { name, args } of functions) {
		if (name === 'drop-shadow') {
			const parsed = first ? undefined : shadow(args)
			if (parsed) first = parsed
			else unsupportedFilters.push(name)
			continue
		}
		const colour = isColourFilter(name) && colourFilter(name, args)
		if (colour) colours.push(colour)
		else unsupportedFilters.push(name)
	}
	if (unreadable) unsupportedFilters.push(unreadable)
	return { colours, shadow: first, unsupportedFilters }
}

/**
 * A style's `z-index`: 0 for `auto` or none, which is where a page stacks
 * those too.
 */
export function zIndex(style: JSX.CSSProperties | undefined) {
	return Number.parseInt(String(style?.['z-index']), 10) || 0
}

/** Whether a `z-index` is one a page reads: a whole number, `auto` or none. */
function readableZIndex(value: unknown) {
	return (
		absent(value) ||
		(typeof value === 'number' && Number.isInteger(value)) ||
		/^\s*([+-]?\d+|auto)\s*$/.test(String(value))
	)
}

/**
 * A Controller's own `style`, translated into what a canvas can do with it.
 * It reads only the keys it knows, so it never parses anything else.
 */
export function translateStyle(
	style: JSX.CSSProperties | undefined,
): TranslatedStyle {
	const css = (style ?? {}) as Record<string, unknown>
	const opacity = absent(css.opacity) ? 1 : amount(css.opacity)
	const visibility = absent(css.visibility) ? undefined : String(css.visibility)
	const rendering = absent(css['image-rendering'])
		? undefined
		: String(css['image-rendering']).trim()
	const pixelated =
		rendering === undefined ? undefined : pixelatedBy.get(rendering)
	return {
		alpha: clamp(opacity ?? 1),
		visible:
			visibility === undefined || visibility === 'inherit'
				? undefined
				: visibility === 'visible',
		removed: css.display === 'none',
		zIndex: zIndex(style),
		pixelated,
		...translateFilter(css.filter),
		unsupportedTransforms: unsupportedTransforms(css.transform),
		unreadable: [
			...(opacity === undefined ? ['opacity'] : []),
			...(readableZIndex(css['z-index']) ? [] : ['z-index']),
			...(rendering !== undefined && pixelated === undefined
				? ['image-rendering']
				: []),
			...unreadablePlacement(css),
		],
		untranslatable: Object.keys(css).filter(
			(key) => !translatedKeys.has(key) && !absent(css[key]),
		),
	}
}

/**
 * The style a Controller is drawn with, carriers and all, whichever Renderer
 * draws it: the Canvas Renderer paints with it, and the Pointer Pick leaves
 * out what it hides.
 */
export interface EffectiveStyle {
	/**
	 * Its opacity times every carrier's, as a page's nested elements fade
	 * together.
	 */
	alpha: number
	/** Whether it's painted at all. */
	hidden: boolean
	/**
	 * Its colour filters, then every carrier's, as a page filters an element
	 * and then the elements around it.
	 */
	colours: ColourFilter[]
	/**
	 * The shadow it casts, which is the first of its own `drop-shadow`s, or
	 * else of the nearest carrier's: a canvas has only one. Its offset and
	 * blur are in the Sprite's own pixels, even when they're a carrier's,
	 * which is close enough unless a part is turned against its carrier.
	 */
	shadow: Shadow | undefined
	/**
	 * Whether its image smoothing is off, by the nearest `image-rendering`
	 * that says, itself first. The DOM Renderer nests an Attached Controller
	 * inside its carrier, so a carrier's `image-rendering` reaches its parts
	 * as CSS inherits it, unless a part says otherwise. The Renderer's own
	 * `pixelated` prop turns it off whatever this says.
	 */
	pixelated: boolean
}

/**
 * How a Controller is painted: its own style with what it inherits from
 * every Controller carrying it, as the DOM Renderer nests it inside them.
 */
export function effectiveStyle(controller: AnyController): EffectiveStyle {
	let alpha = 1
	let visible: boolean | undefined
	let removed = false
	const colours: ColourFilter[] = []
	let shadow: Shadow | undefined
	let pixelated: boolean | undefined
	for (
		let level: AnyController | undefined = controller;
		level;
		level = level.carrier()
	) {
		const own = translateStyle(level.sprite().style)
		alpha *= own.alpha
		// The nearest that says, itself first
		visible ??= own.visible
		removed ||= own.removed
		colours.push(...own.colours)
		shadow ??= own.shadow
		pixelated ??= own.pixelated
	}
	return {
		alpha,
		hidden: removed || visible === false,
		colours,
		shadow,
		pixelated: pixelated ?? false,
	}
}
