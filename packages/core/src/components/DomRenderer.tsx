import {
	type Accessor,
	type Component,
	For,
	type JSX,
	type Setter,
} from 'solid-js'
import type { AnyController } from '../Controller'
import type { Scene } from '../Scene'
import { sortByAssetOrder } from '../drawOrder'
import type { Vector } from '../types'
import { RendererShell } from './RendererShell'
import { ControllerSprite } from './Sprite'

export type CanvasControllers = { id: string; controller: AnyController }[]

export interface DomRendererProps {
	ref?: HTMLDivElement | undefined
	scene: Scene
	loading?: Component<{ scene: Scene }>
	dialog?: Component<{ scene: Scene }>
	/** Drawn over the sprites, but under the `dialog`. */
	underDialog?: JSX.Element
	overlay?: JSX.Element
	underlay?: JSX.Element
	/** After the renderer's own styles: its background is white unless set here. */
	style?: JSX.CSSProperties
	class?: string
	/**
	 * Keeps the scene running even with the renderer off the screen: for a
	 * game that moves it about itself, like a camera looking a long way up a
	 * mountain.
	 */
	runOffScreen?: boolean
	onClick?: (event: Vector) => void
	onMouseDown?: (event: Vector) => void
	onMouseUp?: (event: Vector) => void
}

/**
 * The scene's view of itself: the camera's x and y, its size and its
 * controllers. It's `scene.canvas`, and only shares its name with the
 * deprecated `Canvas` component.
 */
export interface Canvas<T extends CanvasControllers = CanvasControllers> {
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

/**
 * The DOM Renderer. Draws a scene: every controller as a sprite, in
 * `assetOrder`. It's a `<div>`, not a `<canvas>`, each sprite a `<div>` of its
 * own.
 */
export function DomRenderer(props: DomRendererProps) {
	// Shared with `scene.controllersAt`, so what a click finds is what's on top
	const sprites = () => sortByAssetOrder(props.scene)

	const drawn = () => (
		<For each={sprites()}>
			{(controller) => (
				<ControllerSprite
					controller={controller}
					active={props.scene.isActive()}
				/>
			)}
		</For>
	)

	// The `<div>`, pointer and UI layers are the same as the Canvas Renderer's
	return (
		<RendererShell renderer={props}>
			{props.scene.options.cameraLayer ? (
				// The camera moves this one layer (see `cameraLayer`)
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						'pointer-events': 'none',
						transform: `translate(${-props.scene.canvas.get().x()}px, ${-props.scene.canvas.get().y()}px)`,
					}}
				>
					{drawn()}
				</div>
			) : (
				drawn()
			)}
		</RendererShell>
	)
}

/** @deprecated Renamed `DomRendererProps`. Goes in 1.0. */
export type CanvasProps = DomRendererProps

/** @deprecated Renamed `DomRenderer`. Goes in 1.0. */
export const Canvas = DomRenderer
