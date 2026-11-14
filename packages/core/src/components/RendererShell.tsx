import { type JSX, onCleanup, onMount } from 'solid-js'
import { SceneContext } from '../SceneContext'
import type { DomRendererProps } from './DomRenderer'
import { Modal } from './Modal'
import { pointerHandlers } from './pointer'

/**
 * What both Renderers are on the page, around however each draws the
 * Sprites, which is `children`: the Renderer's `<div>`, its pointer handlers,
 * and the game's UI layers (underlay, overlay, dialogs, the Modal and the
 * loading screen) over and under the Sprites. It runs the Scene only while
 * it's on the screen, and destroys it along with the Renderer.
 */
export function RendererShell(props: {
	renderer: DomRendererProps
	children: JSX.Element
}) {
	let element: HTMLDivElement | undefined

	// The scene only runs while some of it is on the screen, not while it's
	// scrolled away.
	onMount(() => {
		if (props.renderer.runOffScreen) return
		const observer = new IntersectionObserver(([entry]) =>
			props.renderer.scene.visible.set(entry.isIntersecting),
		)
		if (element) observer.observe(element)
		onCleanup(() => observer.disconnect())
	})

	// The scene goes with its renderer: otherwise its tick carries on running
	// for as long as the page is open, long after anyone can see it.
	onCleanup(() => {
		for (const { controller } of props.renderer.scene.controllers.get()) {
			controller.destroy()
		}
		props.renderer.scene.destroy()
	})

	// The same for both Renderers, so both give the same coordinates
	const pointer = pointerHandlers(props.renderer)

	return (
		<SceneContext.Provider value={props.renderer.scene}>
			{/* The renderer can't be focused, so it has no keys of its own: anything
			    on it a keyboard can reach is a link or a button inside it. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
			<div
				ref={(el) => {
					element = el
					props.renderer.ref = el
				}}
				data-game-scene={props.renderer.scene.id}
				class={props.renderer.class}
				style={{
					position: 'relative',
					overflow: 'hidden',
					background: 'white',
					width: `${props.renderer.scene.canvas.get().width()}px`,
					height: `${props.renderer.scene.canvas.get().height()}px`,
					...props.renderer.style,
				}}
				onClick={pointer.onClick}
				onTouchStart={pointer.onTouchStart}
				onTouchEnd={pointer.onTouchEnd}
				onMouseDown={pointer.onMouseDown}
				onMouseUp={pointer.onMouseUp}
			>
				{props.renderer.underlay}
				{props.children}
				{props.renderer.underDialog}
				{props.renderer.dialog && (
					<props.renderer.dialog scene={props.renderer.scene} />
				)}
				{props.renderer.scene.modal.get() && (
					<Modal>{props.renderer.scene.modal.get()}</Modal>
				)}
				{props.renderer.overlay}
				{props.renderer.loading && props.renderer.scene.loading.get() && (
					<props.renderer.loading scene={props.renderer.scene} />
				)}
			</div>
		</SceneContext.Provider>
	)
}
