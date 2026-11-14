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
		const element = event.currentTarget as HTMLElement
		const rect = element.getBoundingClientRect()
		// A game can scale the Renderer with CSS, as run-game does to fit the
		// window: the pointer's on the screen, where the scene's pixels are
		// bigger or smaller, by however much it's been scaled. The element's
		// own size, before any transform, is the scene's.
		const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1
		const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : 1
		const camera = props.scene.canvas.get()
		const pointer =
			'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : event
		return {
			x: (pointer.clientX - rect.left) / scaleX + camera.x(),
			y: (pointer.clientY - rect.top) / scaleY + camera.y(),
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
