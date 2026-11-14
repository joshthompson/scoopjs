import { afterEach, describe, expect, it } from 'vitest'
import { Scene } from '../src/Scene'
import { pointerHandlers } from '../src/components/pointer'
import type { Vector } from '../src/types'

/**
 * A Renderer's element `width` × `height` before any transform, shown on the
 * screen at `rect`, as a CSS transform would put it there.
 */
function element(
	width: number,
	height: number,
	rect: { left: number; top: number; width: number; height: number },
) {
	const el = document.createElement('div')
	Object.defineProperty(el, 'offsetWidth', { value: width })
	Object.defineProperty(el, 'offsetHeight', { value: height })
	el.getBoundingClientRect = () =>
		({ ...rect, x: rect.left, y: rect.top }) as DOMRect
	return el
}

describe("a Renderer's pointer", () => {
	const scenes: Scene[] = []
	afterEach(() => {
		for (const scene of scenes.splice(0)) scene.destroy()
	})

	/** Where a click at (`clientX`, `clientY`) on `el` lands in a Scene. */
	function clickAt(
		el: HTMLElement,
		clientX: number,
		clientY: number,
		camera = { x: 0, y: 0 },
	) {
		const scene = new Scene('pointer', { width: 960, height: 540, ...camera })
		scenes.push(scene)
		const clicks: Vector[] = []
		const handlers = pointerHandlers({
			scene,
			onClick: (at) => clicks.push(at),
		})
		el.addEventListener('click', handlers.onClick)
		el.dispatchEvent(new MouseEvent('click', { clientX, clientY }))
		return clicks[0]
	}

	it("gives the scene's coordinates, the camera's position added on", () => {
		const el = element(960, 540, { left: 10, top: 20, width: 960, height: 540 })
		expect(clickAt(el, 110, 70, { x: 300, y: -40 })).toEqual({
			x: 400,
			y: 10,
		})
	})

	it('under a CSS scale, in scene pixels rather than screen pixels', () => {
		// run-game's 960×540 stage, scaled to fit a 1267×713 window
		const el = element(960, 540, { left: 0, top: 0, width: 1267, height: 713 })
		const at = clickAt(el, 1267 / 2, 713 / 2)
		expect(at.x).toBeCloseTo(480)
		expect(at.y).toBeCloseTo(270)
	})
})
