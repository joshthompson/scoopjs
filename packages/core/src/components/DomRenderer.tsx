import {
	type Accessor,
	type Component,
	For,
	type JSX,
	type Setter,
	onCleanup,
	onMount,
} from 'solid-js'
import type { Controller } from '../Controller'
import type { Scene } from '../Scene'
import { SceneContext } from '../SceneContext'
import { sortByAssetOrder } from '../drawOrder'
import type { Vector } from '../types'
import { Modal } from './Modal'
import { ControllerSprite } from './Sprite'

// biome-ignore lint/suspicious/noExplicitAny: controllers of any shape
export type CanvasControllers = { id: string; controller: Controller<any> }[]

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
	let element: HTMLDivElement | undefined

	// The scene only runs while some of it is on the screen, not while it's
	// scrolled away.
	onMount(() => {
		if (props.runOffScreen) return
		const observer = new IntersectionObserver(([entry]) =>
			props.scene.visible.set(entry.isIntersecting),
		)
		if (element) observer.observe(element)
		onCleanup(() => observer.disconnect())
	})

	// The scene goes with its renderer: otherwise its tick carries on running
	// for as long as the page is open, long after anyone can see it.
	onCleanup(() => {
		for (const { controller } of props.scene.controllers.get()) {
			controller.destroy()
		}
		props.scene.destroy()
	})

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

	const getMousePosition = (event: MouseEvent | TouchEvent) => {
		const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect()
		const x =
			(event instanceof MouseEvent
				? event.clientX - rect.left
				: event.touches[0].clientX - rect.left) + props.scene.canvas.get().x()
		const y =
			(event instanceof MouseEvent
				? event.clientY - rect.top
				: event.touches[0].clientY - rect.top) + props.scene.canvas.get().y()
		return { x, y }
	}

	const handleClick = (e: MouseEvent) => props.onClick?.(getMousePosition(e))
	const handleTouchStart = (e: TouchEvent) => {
		props.onClick?.(getMousePosition(e))
		props.onMouseDown?.(getMousePosition(e))
	}
	const handleTouchEnd = (e: TouchEvent) => {
		props.onClick?.(getMousePosition(e))
		props.onMouseUp?.(getMousePosition(e))
	}
	const handleMouseDown = (e: MouseEvent) =>
		props.onMouseDown?.(getMousePosition(e))
	const handleMouseUp = (e: MouseEvent) =>
		props.onMouseUp?.(getMousePosition(e))

	return (
		<SceneContext.Provider value={props.scene}>
			{/* The renderer can't be focused, so it has no keys of its own: anything
			    on it a keyboard can reach is a link or a button inside it. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
			<div
				ref={(el) => {
					element = el
					props.ref = el
				}}
				data-game-scene={props.scene.id}
				class={props.class}
				style={{
					position: 'relative',
					overflow: 'hidden',
					background: 'white',
					width: `${props.scene.canvas.get().width()}px`,
					height: `${props.scene.canvas.get().height()}px`,
					...props.style,
				}}
				onClick={handleClick}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
			>
				{props.underlay}
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
				{props.underDialog}
				{props.dialog && <props.dialog scene={props.scene} />}
				{props.scene.modal.get() && <Modal>{props.scene.modal.get()}</Modal>}
				{props.overlay}
				{props.loading && props.scene.loading.get() && (
					<props.loading scene={props.scene} />
				)}
			</div>
		</SceneContext.Provider>
	)
}

/** @deprecated Renamed `DomRendererProps`. Goes in 1.0. */
export type CanvasProps = DomRendererProps

/** @deprecated Renamed `DomRenderer`. Goes in 1.0. */
export const Canvas = DomRenderer
