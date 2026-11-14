import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ControllerBaseType, createController } from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import { createCanvasPainter } from '../src/canvasPainter'
import { childrenToDraw } from '../src/children'
import {
	fakeImages,
	recordCanvases,
	stubAnimationFrames,
} from './helpers/canvas'

/** A Sprite with something drawn inside it. */
function withChildren(id: string) {
	return createController<ControllerBaseType>({
		frames: [`${id}.png`],
		init: () => {
			const [x, setX] = createSignal(0)
			const [y, setY] = createSignal(0)
			return {
				id,
				type: id,
				x,
				y,
				setX,
				setY,
				width: () => 10,
				height: () => 10,
				children: () => `inside ${id}`,
			}
		},
	})
}

describe("the Scene's skipChildren bench switch", () => {
	let scenes: Scene[]

	beforeEach(() => {
		vi.useFakeTimers()
		scenes = []
	})

	afterEach(() => {
		for (const scene of scenes) scene.destroy()
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	function scene(
		controllers: ReturnType<typeof withChildren>[],
		options: Partial<SceneOptions> = {},
	) {
		const created = new Scene('test', {
			width: 100,
			height: 100,
			...options,
			setup: (s) => s.addController(...controllers),
		})
		scenes.push(created)
		return created
	}

	/** What the Sprite would draw inside itself, called as a Sprite calls it. */
	function drawn(s: Scene, controller: ReturnType<typeof withChildren>) {
		const children = childrenToDraw(s, controller.sprite())
		return typeof children === 'function' ? children() : children
	}

	it("leaves a Sprite's children drawn when it's off", () => {
		const a = withChildren('a')
		const s = scene([a])
		expect(drawn(s, a)).toBe('inside a')
	})

	it("draws no Sprite's children when it's on", () => {
		const a = withChildren('a')
		const s = scene([a], { skipChildren: true })
		expect(drawn(s, a)).toBeUndefined()
	})

	it("draws no Attached Controller's children either", () => {
		const carrier = withChildren('carrier')
		const hat = withChildren('hat')
		carrier.attach(hat)
		const s = scene([carrier], { skipChildren: true })
		expect(drawn(s, hat)).toBeUndefined()
	})

	it("still has the Canvas Renderer paint every Sprite's Frame", () => {
		const contexts = recordCanvases()
		const frames = stubAnimationFrames()
		const images = fakeImages()
		images.load('a.png', 10, 10)
		const s = scene([withChildren('a')], { skipChildren: true })
		s.loading.set(false)
		const painter = createCanvasPainter({
			scene: s,
			canvas: document.createElement('canvas'),
			loadImage: images.loader,
		})
		frames.run()
		const ctx = contexts[contexts.length - 1]
		painter.dispose()
		expect(ctx.draws.map((draw) => draw.image)).toEqual(['a.png'])
	})
})
