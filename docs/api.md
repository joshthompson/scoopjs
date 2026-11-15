# API

Everything `scoopjs` exports, grouped. Signatures are from the source,
trimmed of comments. Anything not listed here isn't public.

```ts
import { CanvasRenderer, Scene, createController } from 'scoopjs'
```

## Scene

### `Scene`

```ts
class Scene<C extends AnyController = AnyController> {
	constructor(id: string, options: SceneOptions)

	id: string
	options: SceneOptions
	/** How long a Tick is, in milliseconds. */
	frameRate: number
	/** Run at the end of every Tick, paused or not. */
	tickers: Set<() => void>

	loading: ObjectSignal<boolean>
	/** Whether any of it is on the screen, as its Renderer sees it. */
	visible: ObjectSignal<boolean>
	modal: ObjectSignal<JSX.Element | undefined>
	loadingAssetCount: ObjectSignal<number>
	loadingAssetTotal: ObjectSignal<number>
	controllers: ObjectSignal<CanvasControllers>
	/** The camera and the view's size. */
	canvas: ObjectSignal<Canvas>

	addController(...controllers: (C | undefined)[]): void
	removeController(id: string): void
	getAllControllers(): AnyController[]
	getControllerById<T = AnyController>(id: string): T | undefined
	getControllersByType<T = AnyController>(type: string): T[]
	controllersAt(point: Vector): C[]
	canvasIssues(): CanvasIssue[]
	getSolidControllerRects(): Rect[]
	resolveAsset(url: string): string
	isActive(): boolean
	setWidth(width: number): void
	destroy(): void
}
```

One running game world. It starts as soon as it's made. See
[Scenes](/guide/scenes).

- `addController` adds several at once, skipping `undefined`.
- `removeController` removes every Controller added with that id.
- The lookups include Attached Controllers, however deep. Their arrays are
  shared: don't change them.
- `controllersAt` is the Pointer Pick: the Controllers drawn over a point in
  Scene coordinates, topmost first, leaving out hidden ones. See
  [Input](/guide/input#which-controller-was-clicked).
- `canvasIssues` lists the [Canvas Issues](/renderers/canvas-issues) so far.
- `getSolidControllerRects` gives the solid boxes of the Controllers added
  to the Scene itself.
- `isActive` is false while it's loading or a Modal is up.
- `destroy` stops it for good. Its Renderer calls it when it's unmounted.
- `setup`, `load` and `preloadAssets` are public too, but the Scene runs
  them itself as it starts. `createCanvas` makes the `canvas` signal's
  value.

### `SceneOptions`

```ts
interface SceneOptions {
	width: number
	height: number
	x?: number
	y?: number
	setup?: (scene: Scene) => void
	afterEnterFrames?: (data: { $scene: Scene }) => void
	images?: string[]
	frameRate?: number // 40
	assetOrder?: (string | string[])[]
	resolveAsset?: (url: string) => string
	cameraLayer?: boolean // false
	standbyFrames?: boolean // false
	frameClock?: 'tick' | 'display' // 'tick'
	skipChildren?: boolean // false
}
```

See [Scenes: options](/guide/scenes#options).

### `Canvas`

```ts
interface Canvas<T extends CanvasControllers = CanvasControllers> {
	width: Accessor<number>
	setWidth: Setter<number>
	height: Accessor<number>
	setHeight: Setter<number>
	x: Accessor<number>
	setX: Setter<number>
	y: Accessor<number>
	setY: Setter<number>
	controllers: Accessor<T>
}
```

The value of `scene.canvas`: the camera's position and the view's size.
It only shares its name with the deprecated `Canvas` component. See [The
camera](/guide/scenes#the-camera-scene-canvas).

### `CanvasControllers`

```ts
type CanvasControllers = { id: string; controller: AnyController }[]
```

What `scene.controllers` holds: the Controllers added to the Scene itself.

### `SceneComponent`

```ts
type SceneComponent<T extends {} = any> = Component<
	{ setScene: (scene: string, mode?: string) => void; mode?: string } & T
>
```

A type for a game's own Scene components, given a way to move to another.
ScoopJS doesn't use it itself.

### `SceneContext`

```ts
const SceneContext: Context<Scene | undefined>
```

The Scene a Renderer is drawing, provided to everything inside the
Renderer's element, the UI layers included.

## Controllers

### `createController`

```ts
function createController<CP extends ControllerBaseType>(
	options: ControllerProps<CP>,
): Controller<CP>
```

Makes a Controller. See [Controllers](/guide/controllers).

### `ControllerProps`

```ts
interface ControllerProps<T extends ControllerBaseType> {
	init: () => T
	frames?: string[]
	solid?: SolidRect
	blockedBySolid?: boolean
	randomStartFrame?: boolean
	class?: string
	style?: JSX.CSSProperties
	onEnterFrame?: (data: {
		$: T
		$scene: Scene
		$age: number
		$currentFrame: number
		$controller: Controller<T>
	}) => void
	onMount?: (data: {
		$: T
		$scene: Scene
		$currentFrame: number
		$controller: Controller<T>
		$ref: HTMLDivElement | undefined
	}) => void
	draw?: (data: DrawData<T>) => void
	drawReach?: DrawReach
}
```

### `ControllerBaseType`

```ts
type ControllerBaseType = {
	id: string
	type: string
	x: Accessor<number>
	y: Accessor<number>
	setX?: Setter<number>
	setY?: Setter<number>
	scene?: Scene
	style?: Accessor<JSX.CSSProperties | undefined>
	width: Accessor<number>
	height: Accessor<number>
	inner?: {
		rotation?: Accessor<number>
		origin?: Accessor<Vector>
		style?: Accessor<JSX.CSSProperties>
	}
	children?: Accessor<JSX.Element>
} & Partial<Accessorise<Omit<Sprite, 'inner' | 'children'>>>
```

What a Controller's data must have, and may have. The last line means any
other [`Sprite`](#sprite) field can be given as a signal: `frames`, `frame`,
`state`, `frameInterval`, `rotation`, `origin`, `xScale`, `yScale`,
`parallax`, `class`. `scene` is set by the Scene the Controller is added
to. Extend it for data of your own.

### `Controller`

```ts
interface Controller<CP extends ControllerBaseType> {
	type: string
	id: string
	frames?: string[]
	solid: SolidRect
	data: CP
	sprite: Accessor<Sprite>
	age: Accessor<number>
	currentFrame: Accessor<number>
	childControllers: Accessor<AnyController[]>
	carrier: Accessor<AnyController | undefined>
	hitTest: (other: AnyController) => boolean
	distanceTo: (x: number, y: number) => number
	direction: (x: number, y: number) => number
	attach: (controller: AnyController) => void
	onEnterFrame: (scene: Scene) => void
	stepFrame: (step: FrameStep) => void
	setGame: (scene: Scene) => void
	destroy: () => void
	draw?: (painting: DrawPainting) => void
	drawReach?: Reach
}
```

- `hitTest` compares where the two are drawn. See [Collision](/guide/collision#hittest).
- `distanceTo` and `direction` (radians) measure from its `x` and `y`.
- `attach` carries another Controller. See [Attached Controllers](/guide/attached-controllers).
- `age` counts the unpaused Ticks it has run; `currentFrame` is the Frame on
  screen.
- `frames` is the `frames` option it was made with.
- The Scene calls `onEnterFrame`, `stepFrame` and `setGame`, and a Renderer
  `destroy` (which does nothing yet). A game doesn't need to.
- `draw` and `drawReach` are only there if it was made with them.

### `AnyController`

```ts
type AnyController = Controller<any>
```

A Controller of any shape, for code that works with every one.

### `createConnectedController`

```ts
function createConnectedController<
	C extends AnyController,
	T extends {} = ControllerBaseType,
>(options: {
	type: string | ((baseType: string) => string)
	base: C
	offset: Vector
	width: ($: DataOf<C>) => number
	height: ($: DataOf<C>) => number
	frames?: string[]
	x?: ($: DataOf<C>, $age: number) => number
	y?: ($: DataOf<C>, $age: number) => number
	rotation?: ($: DataOf<C>, $age: number) => number
	origin?: Vector
	frame?: ($: DataOf<C>) => number
	frameInterval?: ($: DataOf<C>) => number
	state?: ($: DataOf<C>) => 'play' | 'pause' | undefined
	style?: ($: DataOf<C>) => JSX.CSSProperties
	randomStartFrame?: boolean
	init?: ($: DataOf<C>, $age: number) => T
	onEnterFrame?: ControllerProps<T & ControllerBaseType>['onEnterFrame']
	onMount?: ControllerProps<T & ControllerBaseType>['onMount']
	draw?: ControllerProps<T & ControllerBaseType>['draw']
	drawReach?: DrawReach
	xScale?: ($: DataOf<C>) => number
	transformOrigin?: Vector
	solid?: SolidRect
}): Controller<T & ControllerBaseType>
```

Makes a Controller whose data follows `base`'s, to attach to it. `DataOf<C>`
here stands for the base's data type. `width`, `height` and `xScale` are
given the base's data. `transformOrigin` is a deprecated name for `origin`.
See [`createConnectedController`](/guide/attached-controllers#createconnectedcontroller).

### Draw Hook types

```ts
interface DrawPainting {
	ctx: CanvasRenderingContext2D
	drawDefault: () => void
	image: (url: string) => DrawImage | undefined
	$scene: Scene
}

interface DrawData<T extends ControllerBaseType> extends DrawPainting {
	$: T
	$currentFrame: number
}

interface DrawImage {
	image: CanvasImageSource
	width: number
	height: number
}

type DrawReach = number | Partial<Reach>

interface Reach {
	left: number
	top: number
	right: number
	bottom: number
}
```

`DrawData` is what a [Draw Hook](/renderers/draw-hooks) is called with.
`DrawPainting` is the part the Canvas Renderer gives a Controller's `draw`,
before the Controller adds its own data. `DrawReach` is the `drawReach`
option as a game gives it; `Reach` is how the Controller keeps it.

### `FrameStep`

```ts
type FrameStep =
	| { elapsed: number; paused?: boolean }
	| { now: number; paused?: boolean }
```

One step of a frame clock, for `controller.stepFrame`: a Tick that took
`elapsed` milliseconds, or a display refresh at `now`. The Scene steps
Frames itself.

## Renderers and components

### `DomRenderer`

```ts
function DomRenderer(props: DomRendererProps): JSX.Element
```

The DOM Renderer. See [DOM Renderer](/renderers/dom-renderer).

### `DomRendererProps`

```ts
interface DomRendererProps {
	scene: Scene
	ref?: HTMLDivElement | undefined
	loading?: Component<{ scene: Scene }>
	dialog?: Component<{ scene: Scene }>
	underDialog?: JSX.Element
	overlay?: JSX.Element
	underlay?: JSX.Element
	style?: JSX.CSSProperties
	class?: string
	runOffScreen?: boolean
	onClick?: (event: Vector) => void
	onMouseDown?: (event: Vector) => void
	onMouseUp?: (event: Vector) => void
}
```

### `CanvasRenderer`

```ts
function CanvasRenderer(props: CanvasRendererProps): JSX.Element
```

The Canvas Renderer. See [Canvas Renderer](/renderers/canvas-renderer).

### `CanvasRendererProps`

```ts
interface CanvasRendererProps extends DomRendererProps {
	pixelated?: boolean
}
```

### `Canvas` and `CanvasProps` (deprecated)

```ts
/** @deprecated Renamed `DomRenderer`. Goes in 1.0. */
const Canvas = DomRenderer
/** @deprecated Renamed `DomRendererProps`. Goes in 1.0. */
type CanvasProps = DomRendererProps
```

The DOM Renderer's names before 0.3.0. See [The deprecated
`Canvas`](/renderers/dom-renderer#the-deprecated-canvas).

### `Sprite`

```ts
interface Sprite {
	ref?: HTMLDivElement | undefined
	frames: string[]
	frame?: number
	currentFrame?: number
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
	inner?: { rotation?: number; origin?: Vector; style?: JSX.CSSProperties }
	parallax?: number
	children?: JSX.Element | (() => JSX.Element)
	onClick?: () => void
	onChangeFrame?: (frameIndex: number) => void
	onMount?: (data: { $ref: HTMLDivElement | undefined }) => void
	controllers?: Accessor<AnyController[]>
}

const Sprite: Component<
	Sprite & { active?: boolean; id?: string; type?: string; fixed?: boolean }
>
```

The interface is what a Controller's `sprite()` gives, and what both
Renderers draw. The component draws one as page elements. Without a
Controller (no `currentFrame`), it steps through its own Frames, telling
`onChangeFrame` each one. It needs a Renderer around it, for the Scene. See
[Sprites and Frames](/guide/sprites-and-frames).

### `ControllerSprite`

```ts
function ControllerSprite(props: {
	controller: AnyController
	active?: boolean
	fixed?: boolean
}): JSX.Element
```

A Controller drawn as a `Sprite` component, as the DOM Renderer draws each
one.

## Collision

```ts
type SolidRectInner = boolean | Rect
type SolidRect = SolidRectInner | Accessor<SolidRectInner>

function isOverlapping(a: Rect | undefined, b: Rect | undefined): boolean
function blockBySolids(
	data: ControllerBaseType,
	prevX: number,
	prevY: number,
): void
function blockBySolidsRectPlayer(
	data: ControllerBaseType,
	prevX: number,
	prevY: number,
): void
```

- `SolidRect` is a Controller's `solid` option: nothing, its whole box, or
  a rect from its position.
- `isOverlapping` is whether two rects overlap; touching counts.
- `blockBySolids` stops a point that has moved from `prevX`, `prevY` going
  into anything solid in `data.scene`, sliding it along instead.
  `blockBySolidsRectPlayer` does the same for its whole box, as
  `blockedBySolid` does.

See [Collision](/guide/collision).

## Input

### `Key`

```ts
const Key: {
	isDown(key: string): boolean
	get(key: string): Accessor<boolean>
	emulateKeydown(key: string, time?: number): void // 100 ms
	destroy(): void
}
```

Which keys are down, as signals, from one set of listeners on `window`.
Keys are `KeyboardEvent.key` names. `destroy` removes the listeners. See
[Input](/guide/input).

## Signals

### `createObjectSignal`

```ts
function createObjectSignal<T>(initial: T): ObjectSignal<T, 'get', 'set'>
function createObjectSignal<T, GK extends string>(
	initial: T,
	getKey: GK,
): ObjectSignal<T, GK, `set${Capitalize<GK>}`>
```

A Solid signal as an object: `{ get, set }`, or named: `createObjectSignal(0,
'x')` is `{ x, setX }`.

### `ObjectSignal`

```ts
type ObjectSignal<T, GK extends string = 'get', SK extends string = 'set'> =
	{ [K in GK]: Accessor<T> } & { [K in SK]: Setter<T> }
```

## Types

```ts
interface Vector {
	x: number
	y: number
}

interface Rect {
	x: number
	y: number
	width: number
	height: number
}
```

### `CanvasIssue`

```ts
interface CanvasIssue {
	feature: string
	type?: string
	id?: string
	url?: string
	createdAt?: string
	calledFrom?: string[]
	fix?: string
}
```

One [Canvas Issue](/renderers/canvas-issues), as `scene.canvasIssues()`
gives it.
