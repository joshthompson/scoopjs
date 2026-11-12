import {
	type Accessor,
	type Component,
	For,
	Index,
	type JSX,
	batch,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	useContext,
} from 'solid-js'
import type { Controller } from '../Controller'
import { SceneContext } from '../SceneContext'
import type { Vector } from '../types'

export interface Sprite {
	ref?: HTMLDivElement | undefined
	frames: string[]
	frame?: number
	randomStartFrame?: boolean
	x: number
	y: number
	xScale?: number
	yScale?: number
	state?: 'play' | 'pause' | undefined
	width: number
	height: number
	class?: string
	style?: JSX.CSSProperties
	frameInterval?: number | Accessor<number>
	rotation?: number
	origin?: Vector
	inner?: {
		rotation?: number
		origin?: Vector
		style?: JSX.CSSProperties
	}
	parallax?: number
	/**
	 * Drawn inside the sprite. A function is called by the sprite itself, and
	 * again whenever a signal it reads changes, but not on the sprite moving.
	 */
	children?: JSX.Element | (() => JSX.Element)
	onClick?: () => void
	onChangeFrame?: (frameIndex: number) => void
	onMount?: (data: { $ref: HTMLDivElement | undefined }) => void
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	controllers?: Accessor<Controller<any>[]>
}

// One clock for every sprite on `frameClock: 'display'`, rather than a timer
// each, so frame changes are written together just before the browser paints.
const animations = new Set<(now: number) => void>()
let animationFrame: number | undefined

function tickAnimations(now: number) {
	batch(() => {
		for (const animate of animations) animate(now)
	})
	animationFrame = animations.size
		? requestAnimationFrame(tickAnimations)
		: undefined
}

function addAnimation(animate: (now: number) => void) {
	animations.add(animate)
	animationFrame ??= requestAnimationFrame(tickAnimations)
	return () => animations.delete(animate)
}

interface SpriteExtendedProps {
	active?: boolean
	id?: string
	type?: string
	fixed?: boolean
}

export const Sprite: Component<Sprite & SpriteExtendedProps> = (props) => {
	const scene = useContext(SceneContext)
	if (!scene) return

	let ref: HTMLDivElement | undefined

	const [currentFrame, setCurrentFrame] = createSignal(
		props.randomStartFrame
			? Math.floor(Math.random() * props.frames.length)
			: 0,
	)
	createEffect(() => props.onChangeFrame?.(currentFrame()))
	createEffect(
		() => typeof props.frame === 'number' && setCurrentFrame(props.frame),
	)
	const frames = createMemo(() =>
		props.frames.map((frame) => {
			// Every sprite goes through here, so this is where a game's
			// `resolveAsset` swaps in whichever image it wants shown.
			const image = scene.resolveAsset(frame.split('#')[0])
			const [left, top, width, height] = frame
				.split('#')[1]
				?.split(',')
				.map(Number) ?? [0, 0, 0, 0]
			return {
				image,
				left,
				top,
				width,
				height,
			}
		}),
	)

	// With `standbyFrames`, a sprite that switches between separate images
	// keeps them all painted, invisibly, so switching doesn't flash blank.
	const standbyImages = createMemo(() => {
		if (!scene.options.standbyFrames) return []
		const images = [...new Set(frames().map((frame) => frame.image))]
		return images.length > 1 ? images : []
	})

	const frameStyle = createMemo(() => {
		const frame = frames()[currentFrame()]
		if (!frame) return {}
		return {
			'background-image': `url(${frame.image})`,
			'background-position': `${frame.left}px ${frame.top}px`,
			'background-size':
				frame.width && frame.height ? 'auto 100%' : '100% 100%',
		}
	})

	const frameInterval = () =>
		typeof props.frameInterval === 'function'
			? props.frameInterval()
			: (props.frameInterval ?? 100)
	const canAnimate = () =>
		props.active !== false && props.state === 'play' && !!props.frames.length

	if (scene.options.frameClock === 'display') {
		// On the screen's refresh, a step as soon as it mounts, and then one
		// whenever a frame is due. Each step is timed from when the frame was
		// due, so intervals don't round up to the display's own rate.
		const step = () => {
			if (canAnimate()) {
				setCurrentFrame((prev) => (prev + 1) % props.frames.length)
			}
		}
		step()
		let nextFrameAt = performance.now() + frameInterval()
		onCleanup(
			addAnimation((now) => {
				if (now < nextFrameAt) return
				step()
				nextFrameAt = Math.max(nextFrameAt + frameInterval(), now)
			}),
		)
	} else {
		// Stepped through on the scene's tick, so a sprite changes frame in the
		// same update as it moves. The time a frame's been showing carries over
		// from tick to tick, so a frame interval that isn't a whole number of
		// ticks still comes out right on average.
		let shown = 0
		const animate = () => {
			if (!canAnimate()) return
			const interval = frameInterval()
			// An infinite interval is a sprite that never changes frame, like the
			// scenery.
			if (!Number.isFinite(interval) || interval <= 0) return
			shown += scene.frameRate
			const steps = Math.floor(shown / interval)
			if (!steps) return
			shown -= steps * interval
			setCurrentFrame((prev) => (prev + steps) % props.frames.length)
		}
		scene.tickers.add(animate)
		onCleanup(() => scene.tickers.delete(animate))
	}

	// The same children from one move to the next, so they're only drawn again
	// when they're swapped for others, or when a function's signals change.
	const children = createMemo(() => props.children)
	const content = () => {
		const drawn = children()
		return typeof drawn === 'function' ? drawn() : drawn
	}

	onMount(() => props.onMount?.({ $ref: ref }))

	// Where the camera leaves a sprite. Attached sprites (`fixed`) move with
	// whatever carries them. With a `cameraLayer` the layer has moved by the
	// camera already, so only a sprite with parallax needs to move again. The
	// camera is only read when it's needed, so a sprite it doesn't move isn't
	// worked out again every time the camera moves.
	const offset = (camera: () => number) => {
		const parallax = props.parallax ?? 1
		if (props.fixed) return 0
		if (scene.options.cameraLayer) {
			return parallax === 1 ? 0 : camera() * (parallax - 1)
		}
		return camera() * parallax
	}
	const top = createMemo(
		() => `${props.y - offset(() => scene.canvas.get().y())}px`,
	)
	const left = createMemo(
		() => `${props.x - offset(() => scene.canvas.get().x())}px`,
	)

	return (
		<div
			data-controller-id={props.id}
			data-controller-type={props.type}
			ref={(el) => {
				ref = el
				props.ref = el
			}}
			class={props.class}
			style={{
				position: 'absolute',
				top: top(),
				left: left(),
				transform: `scale(${(props.xScale ?? 1).toString()}, ${(props.yScale ?? 1).toString()})`,
				width: `${props.width}px`,
				height: `${props.height}px`,
				'pointer-events': props.onClick ? 'auto' : 'none',
				rotate: `${props.rotation}deg`,
				'transform-origin': props.origin
					? `${props.origin.x}px ${props.origin.y}px`
					: 'center',
				...props.style,
			}}
			onClick={props.onClick}
			onKeyDown={props.onClick}
			onTouchStart={props.onClick}
		>
			<div
				style={{
					width: '100%',
					height: '100%',
					rotate: `${props.inner?.rotation}deg`,
					'transform-origin': props.inner?.origin
						? `${props.inner.origin.x}px ${props.inner.origin.y}px`
						: 'center',
					...frameStyle(),
					// After the frame's own, so a controller can draw a frame some
					// other way: at its own size, say, rather than stretched to fit.
					...(props.inner?.style ?? {}),
				}}
			>
				{content()}
			</div>
			<For each={standbyImages()}>
				{(image) => (
					<div
						style={{ ...styles.standby, 'background-image': `url(${image})` }}
					/>
				)}
			</For>
			<Index each={props.controllers?.() ?? []}>
				{(controller) => (
					<ControllerSprite
						controller={controller()}
						active={props.active}
						fixed
					/>
				)}
			</Index>
		</div>
	)
}

/**
 * A controller drawn as a sprite. Its `sprite()` is the same object every
 * time, with getters, so each part of the sprite only follows the values it
 * reads itself.
 */
export function ControllerSprite(props: {
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	controller: Controller<any>
	active?: boolean
	fixed?: boolean
}) {
	return (
		<Sprite
			{...props.controller.sprite()}
			id={props.controller.id}
			type={props.controller.type}
			active={props.active}
			fixed={props.fixed}
		/>
	)
}

const styles = {
	standby: {
		position: 'absolute',
		inset: 0,
		'background-size': '100% 100%',
		opacity: 0,
		// Keeps it rasterised, so the browser doesn't skip decoding it
		'will-change': 'opacity',
		'pointer-events': 'none',
	},
} satisfies Record<string, JSX.CSSProperties>
