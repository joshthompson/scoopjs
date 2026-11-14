import type { Scene } from '../Scene'
import type { Vector } from '../types'

export interface PointerProps {
	scene: Scene
	onClick?: (event: Vector) => void
	onMouseDown?: (event: Vector) => void
	onMouseUp?: (event: Vector) => void
}

/**
 * A Renderer's click, mouse and touch handlers, which turn where the pointer
 * is on the Renderer's element into the scene's coordinates: the camera's
 * position added on. Shared by both Renderers, so a game's input code gives
 * the same answers whichever draws it.
 */
export function pointerHandlers(props: PointerProps) {
	const position = (event: MouseEvent | TouchEvent) => {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const camera = props.scene.canvas.get()
		const pointer = event instanceof MouseEvent ? event : event.touches[0]
		return {
			x: pointer.clientX - rect.left + camera.x(),
			y: pointer.clientY - rect.top + camera.y(),
		}
	}
	return {
		onClick: (e: MouseEvent) => props.onClick?.(position(e)),
		onTouchStart: (e: TouchEvent) => {
			props.onClick?.(position(e))
			props.onMouseDown?.(position(e))
		},
		onTouchEnd: (e: TouchEvent) => {
			props.onClick?.(position(e))
			props.onMouseUp?.(position(e))
		},
		onMouseDown: (e: MouseEvent) => props.onMouseDown?.(position(e)),
		onMouseUp: (e: MouseEvent) => props.onMouseUp?.(position(e)),
	}
}
