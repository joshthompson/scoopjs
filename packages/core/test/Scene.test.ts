import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ControllerBaseType, createController } from '../src/Controller'
import { Scene } from '../src/Scene'

/** A controller that moves one to the right every tick. */
function walker(id: string) {
	return createController<ControllerBaseType>({
		init: () => {
			const [x, setX] = createSignal(0)
			const [y, setY] = createSignal(0)
			return {
				id,
				type: 'walker',
				x,
				y,
				setX,
				setY,
				width: () => 10,
				height: () => 10,
			}
		},
		onEnterFrame: ({ $ }) => $.setX?.($.x() + 1),
	})
}

describe('Scene', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	/** A scene with `controllers` in it, done loading (it has no images). */
	async function scene(...controllers: ReturnType<typeof walker>[]) {
		const created = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			setup: (s) => s.addController(...controllers),
		})
		// Loading finishes in microtasks, with no time passing at all.
		await vi.advanceTimersByTimeAsync(0)
		expect(created.loading.get()).toBe(false)
		return created
	}

	it('moves every controller once a tick', async () => {
		const a = walker('a')
		const b = walker('b')
		const s = await scene(a, b)
		vi.advanceTimersByTime(30)
		expect(a.data.x()).toBe(3)
		expect(b.data.x()).toBe(3)
		expect(a.age()).toBe(3)
		s.destroy()
	})

	it('runs its tickers and afterEnterFrames every tick, even paused', async () => {
		const ticker = vi.fn()
		const a = walker('a')
		const s = await scene(a)
		s.tickers.add(ticker)
		s.modal.set('paused')
		vi.advanceTimersByTime(20)
		expect(ticker).toHaveBeenCalledTimes(2)
		expect(a.data.x()).toBe(0)
		s.destroy()
	})

	it("doesn't tick while it's off the screen", async () => {
		const a = walker('a')
		const s = await scene(a)
		s.visible.set(false)
		vi.advanceTimersByTime(50)
		expect(a.data.x()).toBe(0)
		s.visible.set(true)
		vi.advanceTimersByTime(10)
		expect(a.data.x()).toBe(1)
		s.destroy()
	})

	it('stops ticking once destroyed', async () => {
		const a = walker('a')
		const s = await scene(a)
		s.destroy()
		vi.advanceTimersByTime(50)
		expect(a.data.x()).toBe(0)
	})

	it('finds controllers by id and by type, attached ones too', async () => {
		const a = walker('a')
		const child = walker('child')
		a.attach(child)
		const s = await scene(a)
		expect(s.getControllerById('child')).toBe(child)
		expect(s.getControllersByType('walker')).toEqual([a, child])
		s.destroy()
	})

	it('passes asset URLs through resolveAsset, or leaves them be', () => {
		const plain = new Scene('plain', { width: 1, height: 1 })
		const dressed = new Scene('dressed', {
			width: 1,
			height: 1,
			resolveAsset: (url) => url.replace('.png', '-snow.png'),
		})
		expect(plain.resolveAsset('tree.png')).toBe('tree.png')
		expect(dressed.resolveAsset('tree.png')).toBe('tree-snow.png')
		plain.destroy()
		dressed.destroy()
	})
})

describe('hitTest', () => {
	it("goes by the controllers' own positions, not the page", () => {
		const a = walker('a')
		const b = walker('b')
		expect(a.hitTest(b)).toBe(true)
		b.data.setX?.(11)
		expect(a.hitTest(b)).toBe(false)
	})
})
