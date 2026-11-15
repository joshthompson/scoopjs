import { type Accessor, createSignal } from 'solid-js'

/**
 * One step of a frame clock. On `'tick'` it's a Tick that took `elapsed`
 * milliseconds; on `'display'` it's a screen refresh at `now`. A `paused`
 * step moves nothing on, but still takes up a newly controlled `frame`.
 */
export type FrameStep =
	| { elapsed: number; paused?: boolean }
	| { now: number; paused?: boolean }

/**
 * A Frame as a Sprite's `frames` lists it: an image URL, or a crop of a
 * sprite sheet as `url#x,y,width,height`. Without a crop, x, y, width and
 * height are 0.
 */
export interface ParsedFrame {
	url: string
	x: number
	y: number
	width: number
	height: number
}

/** Reads a Frame: see `ParsedFrame`. */
export function parseFrame(frame: string): ParsedFrame {
	const [url, crop] = frame.split('#')
	const [x = 0, y = 0, width = 0, height = 0] =
		crop?.split(',').map(Number) ?? []
	return { url, x, y, width, height }
}

/**
 * How long each Frame shows for, in milliseconds, from a Sprite's
 * `frameInterval`, which can be a number or a signal of one: 100 without.
 */
export function frameInterval(
	interval: number | Accessor<number> | undefined,
): number {
	return (typeof interval === 'function' ? interval() : interval) ?? 100
}

/** What a Frame Stepper reads, each time it steps. */
export interface FrameSource {
	frameCount: () => number
	/** Milliseconds each Frame shows for. Infinite never changes Frame. */
	frameInterval: () => number
	playing: () => boolean
	/** A Frame to jump to, from a game's own `frame`. */
	frame: () => number | undefined
	randomStartFrame?: boolean
}

/**
 * A Sprite's current Frame and how it moves on, without anything drawn: a
 * Controller keeps one, and so does a Sprite used without a Controller.
 */
export function createFrameStepper(source: FrameSource): {
	currentFrame: Accessor<number>
	step: (step: FrameStep) => void
} {
	const [stepped, setStepped] = createSignal(
		source.randomStartFrame
			? Math.floor(Math.random() * source.frameCount())
			: 0,
	)
	// The `frame` last taken up. A game setting one jumps there, and the
	// Sprite then plays on from it, as it did when the DOM Sprite stepped.
	let taken: number | undefined
	const newFrame = () => {
		const frame = source.frame()
		return typeof frame === 'number' && frame !== taken ? frame : undefined
	}
	// A controlled `frame` shows as soon as it's set, not a step later, so
	// `$currentFrame` is always what's on screen.
	const currentFrame = () => newFrame() ?? stepped()

	// How long the current Frame has been showing, on `'tick'`
	let shown = 0
	// When the next Frame is due, on `'display'`
	let nextFrameAt: number | undefined

	const advance = (steps: number) => {
		if (!steps || !source.playing()) return
		setStepped((prev) => (prev + steps) % source.frameCount())
	}

	const step = (frameStep: FrameStep) => {
		// A newly set `frame` wins over this step, as the DOM Sprite's did
		const frame = newFrame()
		const jumped = frame !== undefined
		if (jumped) {
			taken = frame
			setStepped(frame)
		}
		// No `frame` now: the one last taken is let go of, so setting it again
		// jumps there again, as the DOM Sprite did whenever `frame` changed
		else if (typeof source.frame() !== 'number') taken = undefined
		const animating =
			!frameStep.paused && source.playing() && source.frameCount() > 0

		if ('now' in frameStep) {
			// A step as soon as it starts, and then one whenever a Frame is due.
			// Each step is timed from when the Frame was due, so intervals don't
			// round up to the display's own rate.
			const { now } = frameStep
			if (nextFrameAt !== undefined && now < nextFrameAt) return
			nextFrameAt =
				nextFrameAt === undefined
					? now + source.frameInterval()
					: Math.max(nextFrameAt + source.frameInterval(), now)
			if (animating && !jumped) advance(1)
			return
		}

		// The time a Frame's been showing carries over from Tick to Tick, so a
		// Frame interval that isn't a whole number of Ticks still comes out
		// right on average.
		if (!animating) return
		const interval = source.frameInterval()
		// An infinite interval is a Sprite that never changes Frame, like the
		// scenery.
		if (!Number.isFinite(interval) || interval <= 0) return
		shown += frameStep.elapsed
		const steps = Math.floor(shown / interval)
		shown -= steps * interval
		if (!jumped) advance(steps)
	}

	return { currentFrame, step }
}
