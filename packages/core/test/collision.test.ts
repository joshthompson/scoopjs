import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { ControllerBaseType } from '../src/Controller'
import type { Scene } from '../src/Scene'
import {
	blockBySolids,
	blockBySolidsRectPlayer,
	isOverlapping,
} from '../src/collision'
import type { Rect } from '../src/types'

describe('isOverlapping', () => {
	const a = { x: 0, y: 0, width: 10, height: 10 }

	it('is true for rects that overlap', () => {
		expect(isOverlapping(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
	})

	it('is true for rects that only touch', () => {
		expect(isOverlapping(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(true)
	})

	it('is false for rects apart, on either axis', () => {
		expect(isOverlapping(a, { x: 11, y: 0, width: 10, height: 10 })).toBe(false)
		expect(isOverlapping(a, { x: 0, y: -11, width: 10, height: 10 })).toBe(
			false,
		)
	})

	it('is false when either is missing', () => {
		expect(isOverlapping(a, undefined)).toBe(false)
	})
})

/** A controller's data at `x, y`, in a scene whose only solid is `solids`. */
function mover(x: number, y: number, solids: Rect[], size = 0) {
	const [getX, setX] = createSignal(x)
	const [getY, setY] = createSignal(y)
	const data: ControllerBaseType = {
		id: 'mover',
		type: 'mover',
		x: getX,
		y: getY,
		setX,
		setY,
		width: () => size,
		height: () => size,
		scene: { getSolidControllerRects: () => solids } as unknown as Scene,
	}
	return data
}

const wall = { x: 10, y: -100, width: 10, height: 200 }

describe('blockBySolids', () => {
	it('lets a move through when nothing is in the way', () => {
		const data = mover(0, 0, [wall])
		data.setX?.(5)
		blockBySolids(data, 0, 0)
		expect(data.x()).toBe(5)
	})

	it('stops a point at the wall it would have gone into', () => {
		const data = mover(0, 0, [wall])
		data.setX?.(15)
		blockBySolids(data, 0, 0)
		expect(data.x()).toBeCloseTo(10, 2)
		expect(data.x()).toBeLessThan(10)
	})

	it('slides along a wall it hits at an angle', () => {
		const data = mover(0, 0, [wall])
		data.setX?.(20)
		data.setY?.(20)
		blockBySolids(data, 0, 0)
		expect(data.x()).toBeLessThan(10)
		expect(data.y()).toBeCloseTo(20, 2)
	})
})

describe('blockBySolidsRectPlayer', () => {
	it('lets a move through when nothing is in the way', () => {
		const data = mover(0, 0, [wall], 4)
		data.setX?.(5)
		blockBySolidsRectPlayer(data, 0, 0)
		expect(data.x()).toBeCloseTo(5, 2)
	})

	it('stops a rect at the wall with its far side, not its corner', () => {
		const data = mover(0, 0, [wall], 4)
		data.setX?.(15)
		blockBySolidsRectPlayer(data, 0, 0)
		expect(data.x()).toBeCloseTo(6, 2)
		expect(data.x()).toBeLessThan(6)
	})
})
