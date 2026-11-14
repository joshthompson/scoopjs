import { onCleanup, onMount } from 'solid-js'
import { SceneContext } from '../SceneContext'
import { createCanvasPainter } from '../canvasPainter'
import type { DomRendererProps } from './DomRenderer'
import { Modal } from './Modal'
import { pointerHandlers } from './pointer'

export interface CanvasRendererProps extends DomRendererProps {
	/**
	 * Turns image smoothing off for every Sprite, so pixel art stays crisp
	 * when it's scaled, as `image-rendering: pixelated` does on the page.
	 */
	pixelated?: boolean
}

/**
 * The Canvas Renderer. Paints a scene's sprites onto one `<canvas>`, in the
 * order the DOM Renderer draws them, with the game's UI layers (underlay,
 * overlay, dialogs, the Modal and the loading screen) still page elements
 * over and under it. A game picks it by putting it on the page in place of
 * `DomRenderer`, with the same props.
 */
export function CanvasRenderer(props: CanvasRendererProps) {
	let element: HTMLDivElement | undefined
	let canvas: HTMLCanvasElement | undefined

	// Everything the canvas shows is painted by `createCanvasPainter`: this
	// only puts it on the page, around the UI layers.
	onMount(() => {
		if (!canvas) return
		const painter = createCanvasPainter({
			scene: props.scene,
			canvas,
			pixelated: () => !!props.pixelated,
		})
		onCleanup(() => painter.dispose())
	})

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

	// Shared with the DOM Renderer, so both give the same coordinates
	const pointer = pointerHandlers(props)

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
				onClick={pointer.onClick}
				onTouchStart={pointer.onTouchStart}
				onTouchEnd={pointer.onTouchEnd}
				onMouseDown={pointer.onMouseDown}
				onMouseUp={pointer.onMouseUp}
			>
				{props.underlay}
				{/* Sized by the painter, to the scene and the screen's density */}
				<canvas
					ref={canvas}
					style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
				/>
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
