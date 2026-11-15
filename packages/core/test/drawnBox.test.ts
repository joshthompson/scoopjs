import { type JSX, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ControllerBaseType, createController } from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import type { Vector } from '../src/types'

interface Box {
	x?: number
	y?: number
	width?: number
	height?: number
	rotation?: number
	xScale?: number
	yScale?: number
	origin?: Vector
	parallax?: number
	style?: JSX.CSSProperties
}

/** A controller that sits still, drawn as `box` says. */
function thing(id: string, box: Box = {}, type = 'thing') {
	return createController<ControllerBaseType>({
		init: () => {
			const [x, setX] = createSignal(box.x ?? 0)
			const [y, setY] = createSignal(box.y ?? 0)
			return {
				id,
				type,
				x,
				y,
				setX,
				setY,
				width: () => box.width ?? 10,
				height: () => box.height ?? 10,
				rotation: () => box.rotation ?? 0,
				xScale: () => box.xScale ?? 1,
				yScale: () => box.yScale ?? 1,
				origin: box.origin && (() => box.origin),
				parallax: () => box.parallax ?? 1,
				style: () => box.style ?? {},
			}
		},
	})
}

describe('hitTest on drawn boxes', () => {
	it('places an attached part on its carrier', () => {
		const carrier = thing('carrier', { x: 100, y: 100 })
		const hand = thing('hand', { x: 5, y: 5 })
		carrier.attach(hand)
		const nearOrigin = thing('near-origin', { x: 0, y: 0 })
		const nearCarrier = thing('near-carrier', { x: 108, y: 108 })
		expect(hand.hitTest(nearOrigin)).toBe(false)
		expect(hand.hitTest(nearCarrier)).toBe(true)
	})

	it('turns attached parts with every carrier, three levels down', () => {
		// The body turns a quarter about its middle, and the arm a quarter more
		// about its shoulder, so the hand ends up left of the body, not right.
		const body = thing('body', { x: 100, y: 100, rotation: 90 })
		const arm = thing('arm', {
			x: 10,
			width: 20,
			rotation: 90,
			origin: { x: 0, y: 0 },
		})
		const hand = thing('hand', { x: 20, origin: { x: 0, y: 0 } })
		body.attach(arm)
		arm.attach(hand)
		expect(hand.hitTest(thing('left', { x: 82, y: 102, width: 5 }))).toBe(true)
		expect(hand.hitTest(thing('right', { x: 131, y: 101, width: 5 }))).toBe(
			false,
		)
	})

	it('mirrors attached parts when their carrier flips', () => {
		const carrier = thing('carrier', { x: 100, y: 100, xScale: -1 })
		const tail = thing('tail', { x: 20 })
		carrier.attach(tail)
		expect(tail.hitTest(thing('left', { x: 82, y: 102, width: 5 }))).toBe(true)
		expect(tail.hitTest(thing('right', { x: 121, y: 101, width: 5 }))).toBe(
			false,
		)
	})

	it('turns a sprite about its origin, from the prop or from style', () => {
		// 20 wide and 10 high, turned a quarter about its top left corner, it
		// hangs down to the left of where it was. About its middle, it wouldn't.
		const below = thing('below', { x: 91, y: 115, width: 2, height: 2 })
		const byProp = thing('by-prop', {
			x: 100,
			y: 100,
			width: 20,
			rotation: 90,
			origin: { x: 0, y: 0 },
		})
		const byStyle = thing('by-style', {
			x: 100,
			y: 100,
			width: 20,
			rotation: 90,
			style: { 'transform-origin': 'top left' },
		})
		const byMiddle = thing('by-middle', {
			x: 100,
			y: 100,
			width: 20,
			rotation: 90,
		})
		expect(byProp.hitTest(below)).toBe(true)
		expect(byStyle.hitTest(below)).toBe(true)
		expect(byMiddle.hitTest(below)).toBe(false)
	})

	it("moves a sprite by its style's transform, turned with the sprite", () => {
		// Turned a quarter, so its own x runs down the screen: CSS applies the
		// style's transform inside the sprite's rotation.
		const turned = thing('turned', {
			x: 100,
			y: 100,
			rotation: 90,
			style: { transform: 'translateX(10px)' },
		})
		expect(turned.hitTest(thing('below', { x: 101, y: 115, width: 2 }))).toBe(
			true,
		)
		expect(turned.hitTest(thing('right', { x: 115, y: 101, width: 2 }))).toBe(
			false,
		)
	})

	it("moves a sprite by its style's translate, outside its rotation", () => {
		const jittered = thing('jittered', {
			x: 100,
			y: 100,
			width: 20,
			rotation: 90,
			style: { translate: '-50% 5px' },
		})
		// Turned about its middle it covers x 105 to 115 and y 95 to 115, and
		// the translate moves that 10 left and 5 down, on the screen.
		expect(jittered.hitTest(thing('in', { x: 95, y: 118, width: 1 }))).toBe(
			true,
		)
		expect(jittered.hitTest(thing('out', { x: 106, y: 96, width: 1 }))).toBe(
			false,
		)
	})

	it("takes a style's transform in place of the flip, as the page does", () => {
		// The DOM Sprite flips with `transform`, which a style's own replaces.
		const lifted = thing('lifted', {
			x: 100,
			y: 100,
			xScale: -1,
			origin: { x: 0, y: 0 },
			style: { transform: 'translateY(-5px)' },
		})
		expect(lifted.hitTest(thing('right', { x: 105, y: 90, width: 1 }))).toBe(
			true,
		)
		expect(lifted.hitTest(thing('left', { x: 92, y: 100, width: 1 }))).toBe(
			false,
		)
	})

	it('skews and scales a sprite by its style transform', () => {
		const skewed = thing('skewed', {
			x: 100,
			y: 100,
			style: { transform: 'scale(2, 1) skewX(45deg)' },
		})
		// Skewed, its corners reach 5 further either side, then it's twice as
		// wide about its middle: x 85 to 125.
		expect(skewed.hitTest(thing('edge', { x: 122, y: 100, width: 1 }))).toBe(
			true,
		)
		expect(skewed.hitTest(thing('past', { x: 127, y: 100, width: 1 }))).toBe(
			false,
		)
	})

	it('grows a scaled sprite about its middle', () => {
		const tall = thing('tall', { x: 100, y: 100, yScale: 2 })
		expect(tall.hitTest(thing('above', { x: 100, y: 94, height: 2 }))).toBe(
			true,
		)
		expect(tall.hitTest(thing('higher', { x: 100, y: 90, height: 2 }))).toBe(
			false,
		)
	})
})

describe('drawn boxes in a scene', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	/** A scene with `controllers` in it, done loading (it has no images). */
	async function scene(
		controllers: ReturnType<typeof thing>[],
		options: Partial<SceneOptions> = {},
	) {
		const created = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			setup: (s) => s.addController(...controllers),
			...options,
		})
		await vi.advanceTimersByTimeAsync(0)
		return created
	}

	it('puts a parallax sprite where the camera leaves it', async () => {
		// Half the parallax, so it's moved half as far as the camera: with the
		// camera 100 along, a shark at 150 shows where the diver at 200 does.
		const shark = thing('shark', { x: 150, parallax: 0.5 })
		const fin = thing('fin', { x: 0, y: 10, parallax: 0.5 })
		shark.attach(fin)
		const diver = thing('diver', { x: 200, y: 5 })
		const s = await scene([shark, diver])
		expect(shark.hitTest(diver)).toBe(false)
		s.canvas.get().setX(100)
		expect(shark.hitTest(diver)).toBe(true)
		// Attached parts go wherever their carrier is drawn, whatever their own
		// parallax.
		expect(fin.hitTest(diver)).toBe(true)
		s.destroy()
	})
})

describe('controllersAt', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	async function scene(
		controllers: ReturnType<typeof thing>[],
		options: Partial<SceneOptions> = {},
	) {
		const created = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			setup: (s) => s.addController(...controllers),
			...options,
		})
		await vi.advanceTimersByTimeAsync(0)
		return created
	}

	const ids = (controllers: { id: string }[]) => controllers.map((c) => c.id)

	it('finds what is drawn under a point, last added on top', async () => {
		const s = await scene([
			thing('first', { x: 0 }),
			thing('second', { x: 5 }),
			thing('away', { x: 50 }),
		])
		expect(ids(s.controllersAt({ x: 7, y: 5 }))).toEqual(['second', 'first'])
		expect(ids(s.controllersAt({ x: 30, y: 5 }))).toEqual([])
		s.destroy()
	})

	it("takes points as the Renderers' pointer handlers give them", async () => {
		// The handlers add the camera's position to where the pointer is on the
		// Renderer. Something with no parallax stays put on the screen, so with
		// the camera 100 along, it's 100 along in the scene too.
		const s = await scene([
			thing('ground', { x: 110 }),
			thing('sun', { x: 10, parallax: 0 }),
		])
		s.canvas.get().setX(100)
		expect(ids(s.controllersAt({ x: 112, y: 5 }))).toEqual(['sun', 'ground'])
		expect(ids(s.controllersAt({ x: 12, y: 5 }))).toEqual([])
		s.destroy()
	})

	it('skips what is hidden, and what display: none hides with it', async () => {
		const van = thing('van', { style: { display: 'none' } })
		van.attach(thing('wheel'))
		const s = await scene([
			thing('ground'),
			thing('ghost', { style: { visibility: 'hidden' } }),
			van,
		])
		expect(ids(s.controllersAt({ x: 5, y: 5 }))).toEqual(['ground'])
		s.destroy()
	})

	it('stacks them as the DOM Renderer does by assetOrder', async () => {
		// The DOM Renderer draws the types listed first over those after them,
		// and types it doesn't list over all of them.
		const s = await scene(
			[
				thing('unlisted', {}, 'cloud'),
				thing('front', {}, 'player'),
				thing('back', {}, 'scenery'),
			],
			{ assetOrder: [['player'], 'scenery'] },
		)
		expect(ids(s.controllersAt({ x: 5, y: 5 }))).toEqual([
			'unlisted',
			'front',
			'back',
		])
		s.destroy()
	})

	it('stacks attached parts over their carrier, under what comes after', async () => {
		const bus = thing('bus')
		const wheel = thing('wheel')
		const driver = thing('driver')
		const hat = thing('hat')
		bus.attach(wheel)
		bus.attach(driver)
		driver.attach(hat)
		const s = await scene([bus, thing('passer-by')])
		expect(ids(s.controllersAt({ x: 5, y: 5 }))).toEqual([
			'passer-by',
			'hat',
			'driver',
			'wheel',
			'bus',
		])
		s.destroy()
	})

	it('restacks by z-index among the top level and among parts', async () => {
		const cloud = thing('cloud')
		const bolt = thing('bolt', { style: { 'z-index': 2 } })
		const rain = thing('rain')
		const shadow = thing('shadow', { style: { 'z-index': '-1' } })
		cloud.attach(bolt)
		cloud.attach(rain)
		cloud.attach(shadow)
		const lifted = thing('lifted', { style: { 'z-index': 1 } })
		const balloon = thing('balloon')
		lifted.attach(balloon)
		const s = await scene([lifted, cloud, thing('later')])
		// A part with a negative z-index goes under its carrier, as on the page,
		// but never out from under the rest of the top level.
		expect(ids(s.controllersAt({ x: 5, y: 5 }))).toEqual([
			'balloon',
			'lifted',
			'later',
			'bolt',
			'rain',
			'cloud',
			'shadow',
		])
		s.destroy()
	})
})
