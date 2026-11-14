import { onCleanup, onMount } from 'solid-js'
import { createCanvasPainter } from '../canvasPainter'
import type { DomRendererProps } from './DomRenderer'
import { RendererShell } from './RendererShell'

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

	// The `<div>`, pointer and UI layers are the same as the DOM Renderer's
	return (
		<RendererShell renderer={props}>
			{/* Sized by the painter, to the scene and the screen's density */}
			<canvas
				ref={canvas}
				style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
			/>
		</RendererShell>
	)
}
