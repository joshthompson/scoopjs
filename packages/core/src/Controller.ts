import { type Accessor, type JSX, type Setter, createSignal } from 'solid-js'
import type { Scene } from './Scene'
import {
	type SolidRect,
	blockBySolidsRectPlayer,
	isOverlapping,
} from './collision'
import type { Sprite } from './components/Sprite'
import { type FrameStep, createFrameStepper } from './frames'
import { drawnBox } from './geometry'
import type { Vector } from './types'

type Accessorise<T> = {
	[K in keyof T]: Accessor<T[K]>
}

export type ControllerBaseType = {
	id: string
	type: string
	x: Accessor<Sprite['x']>
	y: Accessor<Sprite['y']>
	setX?: Setter<Sprite['x']>
	setY?: Setter<Sprite['y']>
	scene?: Scene
	style?: Accessor<Sprite['style']>
	width: Accessor<Sprite['width']>
	height: Accessor<number>
	inner?: {
		rotation?: Accessor<number>
		origin?: Accessor<Vector>
		/** Styles for the frame image, without the controllers attached to it. */
		style?: Accessor<JSX.CSSProperties>
	}
	/** Drawn inside the sprite, and drawn again when a signal it reads changes. */
	children?: Accessor<JSX.Element>
} & Partial<Accessorise<Omit<Sprite, 'inner' | 'children'>>>

export interface Controller<CP extends ControllerBaseType> {
	type: string
	id: string
	frames?: Sprite['frames']
	solid: SolidRect
	onEnterFrame: (scene: Scene) => void
	destroy: () => void
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	hitTest: (other: Controller<any>) => boolean
	distanceTo: (x: number, y: number) => number
	direction: (x: number, y: number) => number
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	attach: (controller: Controller<any>) => void
	setGame: (scene: Scene) => void
	data: CP
	sprite: Accessor<Sprite>
	age: Accessor<number>
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	childControllers: Accessor<Controller<any>[]>
	/** The Controller this one is attached to, if it's attached to one. */
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	carrier: Accessor<Controller<any> | undefined>
	/** The Frame its Sprite shows, which is `$currentFrame`. */
	currentFrame: Accessor<number>
	/**
	 * Moves its Frame on by one step of a frame clock, and its Attached
	 * Controllers' with it. The Scene calls this: a game doesn't need to.
	 */
	stepFrame: (step: FrameStep) => void
	/**
	 * Its Draw Hook, with the Controller's own data filled in, for the Canvas
	 * Renderer to call. Only there if it was given one.
	 */
	draw?: (painting: DrawPainting) => void
}

/** What the Canvas Renderer hands a Controller's Draw Hook. */
export interface DrawPainting {
	/** Already in the Sprite's own box, with its alpha, filter and shadow set. */
	ctx: CanvasRenderingContext2D
	/** Paints the current Frame into the box, as the Canvas Renderer would. */
	drawDefault: () => void
	$scene: Scene
}

/** What a Draw Hook is called with. */
export interface DrawData<T extends ControllerBaseType> extends DrawPainting {
	$: T
	$currentFrame: number
}

interface OnEnterFrameData<T extends ControllerBaseType> {
	$: T
	$scene: Scene
	$age: number
	$currentFrame: number
	$controller: Controller<T>
}

interface OnMountData<T extends ControllerBaseType> {
	$: T
	$scene: Scene
	$currentFrame: number
	$controller: Controller<T>
	$ref: HTMLDivElement | undefined
}

export interface ControllerProps<T extends ControllerBaseType> {
	init: () => T
	frames?: Sprite['frames']
	solid?: SolidRect
	blockedBySolid?: boolean
	randomStartFrame?: Sprite['randomStartFrame']
	class?: Sprite['class']
	style?: Sprite['style']
	onEnterFrame?: (data: OnEnterFrameData<T>) => void
	onMount?: (data: OnMountData<T>) => void
	/**
	 * The Draw Hook: paints the Sprite under the Canvas Renderer in place of
	 * its current Frame, for what the Canvas Renderer can't draw from style.
	 * Its Attached Controllers are still painted after it. The DOM Renderer
	 * never calls it.
	 */
	draw?: (data: DrawData<T>) => void
}

// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
type AnyController = Controller<any>

type ExtractControllerType<T> = T extends Controller<infer A> ? A : never

// How `attach` tells a Controller what's carrying it, without anyone else
// being able to.
const setCarriers = new WeakMap<
	AnyController,
	Setter<AnyController | undefined>
>()

const joinClasses = (...classes: (string | undefined)[]) =>
	classes.filter(Boolean).join(' ')

export function createController<CP extends ControllerBaseType>(
	options: ControllerProps<CP>,
): Controller<CP> {
	const [age, setAge] = createSignal<number>(0)
	const onEnterFrame = options.onEnterFrame
	const [childControllers, setChildControllers] = createSignal<
		// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
		Controller<any>[]
	>([])
	const [carrier, setCarrier] = createSignal<AnyController | undefined>()
	const data: CP = options.init()
	const frames = () => data.frames?.() ?? options.frames ?? []
	// Stepped here rather than by whatever draws the Sprite, so the Frame is
	// the same whichever Renderer draws it, and `$currentFrame` is exactly
	// the Frame on screen.
	const { currentFrame, step: stepOwnFrame } = createFrameStepper({
		frameCount: () => frames().length,
		frameInterval: () => {
			const interval = data.frameInterval?.()
			return (typeof interval === 'function' ? interval() : interval) ?? 100
		},
		playing: () => data.state?.() === 'play',
		frame: () => data.frame?.(),
		randomStartFrame: options.randomStartFrame,
	})
	const stepFrame = (step: FrameStep) => {
		stepOwnFrame(step)
		for (const child of childControllers()) child.stepFrame(step)
	}
	const destroy = () => {}
	const setGame = (scene: Scene) => {
		data.scene = scene
	}
	// Compares where the two are drawn, worked out from the controllers
	// themselves rather than from the page, so a scene behaves the same
	// whatever draws it.
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	const hitTest = (other: Controller<any>) =>
		isOverlapping(drawnBox(controller), drawnBox(other))
	const distanceTo = (x: number, y: number) => {
		return Math.hypot(data.x() - x, data.y() - y)
	}
	const direction = (x: number, y: number) => {
		return Math.atan2(y - data.y(), x - data.x())
	}
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	const attach = (part: Controller<any>) => {
		setChildControllers([...childControllers(), part])
		setCarriers.get(part)?.(controller)
	}

	const controller: Controller<CP> = {
		id: data.id,
		type: data.type,
		frames: options.frames,
		solid: options.solid ?? false,
		onEnterFrame: ($scene) => {
			const prevX = data.x()
			const prevY = data.y()

			onEnterFrame?.({
				$: data,
				$scene,
				$age: age(),
				$currentFrame: currentFrame(),
				$controller: controller,
			})

			if (options.blockedBySolid) {
				blockBySolidsRectPlayer(data, prevX, prevY)
			}
			setAge(age() + 1)

			for (const child of childControllers()) {
				child.onEnterFrame($scene)
			}
		},
		destroy,
		hitTest,
		distanceTo,
		direction,
		attach,
		setGame,
		age,
		data,
		childControllers,
		carrier,
		currentFrame,
		stepFrame,
		sprite: () => sprite,
	}
	const draw = options.draw
	if (draw) {
		controller.draw = (painting) =>
			draw({ ...painting, $: data, $currentFrame: currentFrame() })
	}
	setCarriers.set(controller, setCarrier)

	// One sprite for the controller's whole life, each of its values worked out
	// when it's read. A sprite then only redoes the parts that read whatever
	// changed: a runner moving doesn't recalculate their frames, their insides
	// or their name.
	const sprite: Sprite = {
		get frames() {
			return frames()
		},
		get frame() {
			return data?.frame?.()
		},
		randomStartFrame: options.randomStartFrame ?? false,
		get class() {
			return joinClasses(options.class, data.class?.())
		},
		get style() {
			return { ...options.style, ...data.style?.() }
		},
		get x() {
			return data.x()
		},
		get y() {
			return data.y()
		},
		get origin() {
			return data.origin?.()
		},
		get xScale() {
			return data.xScale?.() ?? 1
		},
		get yScale() {
			return data.yScale?.() ?? 1
		},
		get width() {
			return data.width()
		},
		get height() {
			return data.height?.() ?? 0
		},
		get parallax() {
			return data.parallax?.() ?? 1
		},
		get rotation() {
			return data.rotation?.() ?? 0
		},
		get state() {
			return data.state?.()
		},
		get frameInterval() {
			return data.frameInterval?.()
		},
		// Left for the sprite to call, so they're redrawn when something they
		// show changes rather than whenever the controller moves.
		children: data.children,
		get inner() {
			return {
				rotation: data.inner?.rotation?.(),
				origin: data.inner?.origin?.(),
				style: data.inner?.style?.(),
			}
		},
		get currentFrame() {
			return currentFrame()
		},
		onMount: ({ $ref }) => {
			options.onMount?.({
				$: data,
				// biome-ignore lint/style/noNonNullAssertion: set before the sprite mounts
				$scene: data.scene!,
				$controller: controller,
				$currentFrame: currentFrame(),
				$ref: $ref,
			})
		},
		controllers: childControllers,
	}

	return controller
}

export function createConnectedController<
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	C extends Controller<any>,
	T extends {} = ControllerBaseType,
>(options: {
	type: string | ((baseType: string) => string)
	base: C
	frames?: ControllerProps<ExtractControllerType<C>>['frames']
	offset: Vector
	transformOrigin?: Vector
	origin?: Vector
	solid?: SolidRect
	width: ($: ExtractControllerType<C>) => number
	height: ($: ExtractControllerType<C>) => number
	x?: ($: ExtractControllerType<C>, $age: number) => number
	y?: ($: ExtractControllerType<C>, $age: number) => number
	xScale?: ($: ExtractControllerType<C>) => number
	rotation?: ($: ExtractControllerType<C>, $age: number) => number
	frameInterval?: ($: ExtractControllerType<C>) => number
	state?: ($: ExtractControllerType<C>) => Sprite['state']
	onEnterFrame?: ControllerProps<
		ExtractControllerType<Controller<T & ControllerBaseType>>
	>['onEnterFrame']
	onMount?: ControllerProps<
		ExtractControllerType<Controller<T & ControllerBaseType>>
	>['onMount']
	frame?: ($: ExtractControllerType<C>) => number
	style?: ($: ExtractControllerType<C>) => JSX.CSSProperties
	randomStartFrame?: boolean
	init?: ($: ExtractControllerType<C>, $age: number) => T
}): Controller<T & ControllerBaseType> {
	// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
	return createController<any>({
		frames: options.frames,
		randomStartFrame: options.randomStartFrame ?? false,
		init() {
			const baseData = options.base.data as ExtractControllerType<C>

			return {
				id: `${options.base.id}-${options.type}`,
				type:
					typeof options.type === 'function'
						? options.type(options.base.type)
						: `${options.base.type}-${options.type}`,

				x: () =>
					options.offset.x +
					(options.x ? options.x(baseData, options.base.age()) : 0),
				y: () =>
					options.offset.y +
					(options.y ? options.y(baseData, options.base.age()) : 0),
				rotation: () => options.rotation?.(baseData, options.base.age()) ?? 0,
				origin: () => ({
					x: options.origin?.x ?? 0,
					y: options.origin?.y ?? 0,
				}),
				frame: () => options.frame?.(baseData),
				frameInterval: () => options.frameInterval?.(baseData),
				state: () => options.state?.(baseData),
				width: options.width,
				height: options.height,
				solid: options.solid,
				style: () => options.style?.(baseData),
				...options.init?.(baseData, options.base.age()),
			}
		},
		onEnterFrame: options.onEnterFrame,
		onMount: options.onMount,
	})
}
