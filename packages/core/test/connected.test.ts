import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import {
	type ControllerBaseType,
	createConnectedController,
	createController,
} from '../src/Controller'

type Kart = ControllerBaseType & { size: () => number }

/** A carrier whose data says how big its parts are. */
function kart() {
	const [size, setSize] = createSignal(4)
	const controller = createController<Kart>({
		frames: ['kart.png'],
		init: () => ({
			id: 'kart',
			type: 'kart',
			x: () => 0,
			y: () => 0,
			width: () => 40,
			height: () => 20,
			size,
		}),
	})
	return Object.assign(controller, { setSize })
}

describe('createConnectedController', () => {
	it("works its width and height out from the base's data", () => {
		createRoot((dispose) => {
			const base = kart()
			const wheel = createConnectedController({
				base,
				type: 'wheel',
				offset: { x: 0, y: 0 },
				width: ($) => $.size() * 2,
				height: ($) => $.size(),
			})
			expect([wheel.sprite().width, wheel.sprite().height]).toEqual([8, 4])
			base.setSize(5)
			expect([wheel.sprite().width, wheel.sprite().height]).toEqual([10, 5])
			dispose()
		})
	})

	it("flips by its xScale, from the base's data", () => {
		createRoot((dispose) => {
			const base = kart()
			const flipped = createConnectedController({
				base,
				type: 'flag',
				offset: { x: 0, y: 0 },
				width: () => 4,
				height: () => 4,
				xScale: ($) => ($.size() > 4 ? -1 : 1),
			})
			const plain = createConnectedController({
				base,
				type: 'plain',
				offset: { x: 0, y: 0 },
				width: () => 4,
				height: () => 4,
			})
			expect(flipped.sprite().xScale).toBe(1)
			base.setSize(5)
			expect(flipped.sprite().xScale).toBe(-1)
			expect(plain.sprite().xScale).toBe(1)
			dispose()
		})
	})

	it('is solid where its options say', () => {
		createRoot((dispose) => {
			const base = kart()
			const rect = { x: 1, y: 2, width: 3, height: 4 }
			const bumper = createConnectedController({
				base,
				type: 'bumper',
				offset: { x: 0, y: 0 },
				width: () => 4,
				height: () => 4,
				solid: rect,
			})
			expect(bumper.solid).toEqual(rect)
			dispose()
		})
	})

	it('turns about its transformOrigin when it has no origin', () => {
		createRoot((dispose) => {
			const base = kart()
			const part = (options: {
				origin?: { x: number; y: number }
				transformOrigin?: { x: number; y: number }
			}) =>
				createConnectedController({
					base,
					type: 'arm',
					offset: { x: 0, y: 0 },
					width: () => 4,
					height: () => 4,
					...options,
				}).sprite().origin
			expect(part({ transformOrigin: { x: 2, y: 3 } })).toEqual({ x: 2, y: 3 })
			expect(
				part({ origin: { x: 1, y: 1 }, transformOrigin: { x: 2, y: 3 } }),
			).toEqual({ x: 1, y: 1 })
			expect(part({})).toEqual({ x: 0, y: 0 })
			dispose()
		})
	})
})
