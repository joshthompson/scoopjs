import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	type ControllerBaseType,
	type ControllerProps,
	createConnectedController,
	createController,
} from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import type { Sprite } from '../src/components/Sprite'

const frames = ['a.png', 'b.png', 'c.png', 'd.png']

/** A Controller with four Frames, playing every `frameInterval` ms. */
function animated(
	id: string,
	options: {
		frameInterval?: number
		state?: Sprite['state']
		frame?: () => number | undefined
	} & Partial<ControllerProps<ControllerBaseType>> = {},
) {
	const [state, setState] = createSignal<Sprite['state']>(
		'state' in options ? options.state : 'play',
	)
	const controller = createController<ControllerBaseType>({
		frames,
		...options,
		init: () => ({
			id,
			type: 'animated',
			x: () => 0,
			y: () => 0,
			width: () => 10,
			height: () => 10,
			state,
			frameInterval: () => options.frameInterval ?? 10,
			frame: options.frame,
		}),
	})
	return Object.assign(controller, { setState })
}

describe('frame stepping', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	/** A Scene with 10 ms Ticks and `controllers` in it, done loading. */
	async function scene(
		controllers: ReturnType<typeof createController>[],
		options: Partial<SceneOptions> = {},
	) {
		const created = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			setup: (s) => s.addController(...controllers),
			...options,
		})
		// Loading waits on the Frames' images, which jsdom never loads, so
		// it's finished by hand.
		await vi.advanceTimersByTimeAsync(0)
		created.loading.set(false)
		return created
	}

	it('steps a Frame each interval on the Tick', async () => {
		const a = animated('a', { frameInterval: 20 })
		const s = await scene([a])
		expect(a.currentFrame()).toBe(0)
		vi.advanceTimersByTime(10)
		expect(a.currentFrame()).toBe(0)
		vi.advanceTimersByTime(10)
		expect(a.currentFrame()).toBe(1)
		vi.advanceTimersByTime(60)
		expect(a.currentFrame()).toBe(0)
		s.destroy()
	})

	it('keeps time across Ticks for an interval that isn’t a whole number of them', async () => {
		// 25 ms Frames on 10 ms Ticks: one at 30 ms, then 50, 80 and 100
		const a = animated('a', { frameInterval: 25 })
		const s = await scene([a])
		const seen: number[] = []
		for (let tick = 0; tick < 10; tick++) {
			vi.advanceTimersByTime(10)
			seen.push(a.currentFrame())
		}
		expect(seen).toEqual([0, 0, 1, 1, 2, 2, 2, 3, 3, 0])
		s.destroy()
	})

	it('gives onEnterFrame the Frame that was on screen, not one behind', async () => {
		const seen: number[] = []
		const a = animated('a', {
			frameInterval: 10,
			onEnterFrame: ({ $currentFrame }) => seen.push($currentFrame),
		})
		const s = await scene([a])
		vi.advanceTimersByTime(30)
		expect(seen).toEqual([0, 1, 2])
		expect(a.currentFrame()).toBe(3)
		s.destroy()
	})

	it('starts on a random Frame with randomStartFrame', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.6)
		const a = animated('a', { randomStartFrame: true, state: 'pause' })
		const b = animated('b', { state: 'pause' })
		vi.restoreAllMocks()
		const s = await scene([a, b])
		expect(a.currentFrame()).toBe(2)
		expect(b.currentFrame()).toBe(0)
		s.destroy()
	})

	it('shows a controlled frame as soon as it’s set', async () => {
		const [frame, setFrame] = createSignal<number>()
		const a = animated('a', { frame, state: 'pause' })
		const s = await scene([a])
		setFrame(2)
		expect(a.currentFrame()).toBe(2)
		vi.advanceTimersByTime(50)
		expect(a.currentFrame()).toBe(2)
		setFrame(1)
		expect(a.currentFrame()).toBe(1)
		s.destroy()
	})

	it('jumps to a controlled frame again after it was let go of', async () => {
		// As a runner does: stood on Frame 0, then running with no `frame`,
		// then set to Frame 0 again, standing on skis
		const [frame, setFrame] = createSignal<number | undefined>(0)
		const a = animated('a', { frame, frameInterval: 10 })
		const s = await scene([a])
		vi.advanceTimersByTime(10)
		expect(a.currentFrame()).toBe(0)
		setFrame(undefined)
		vi.advanceTimersByTime(20)
		expect(a.currentFrame()).toBe(2)
		a.setState('pause')
		setFrame(0)
		expect(a.currentFrame()).toBe(0)
		vi.advanceTimersByTime(20)
		expect(a.currentFrame()).toBe(0)
		s.destroy()
	})

	it('plays on from a controlled frame set during a Tick', async () => {
		const [frame, setFrame] = createSignal<number>()
		const seen: number[] = []
		const a = animated('a', {
			frame,
			frameInterval: 10,
			onEnterFrame: ({ $age }) => $age === 2 && setFrame(0),
		})
		const s = await scene([a])
		for (let tick = 0; tick < 5; tick++) {
			vi.advanceTimersByTime(10)
			seen.push(a.currentFrame())
		}
		// Set to 0 in the third Tick, which shows it, and then plays on
		expect(seen).toEqual([1, 2, 0, 1, 2])
		s.destroy()
	})

	it('only steps while its state is play', async () => {
		const a = animated('a', { state: 'pause' })
		const idle = animated('idle', { state: undefined })
		const s = await scene([a, idle])
		vi.advanceTimersByTime(30)
		expect(a.currentFrame()).toBe(0)
		a.setState('play')
		vi.advanceTimersByTime(20)
		expect(a.currentFrame()).toBe(2)
		a.setState('pause')
		vi.advanceTimersByTime(20)
		expect(a.currentFrame()).toBe(2)
		expect(idle.currentFrame()).toBe(0)
		s.destroy()
	})

	it('pauses while a Modal is up', async () => {
		const a = animated('a')
		const s = await scene([a])
		vi.advanceTimersByTime(10)
		s.modal.set('paused')
		vi.advanceTimersByTime(30)
		expect(a.currentFrame()).toBe(1)
		s.modal.set(undefined)
		vi.advanceTimersByTime(10)
		expect(a.currentFrame()).toBe(2)
		s.destroy()
	})

	it('pauses while the Scene is loading', async () => {
		const a = animated('a')
		const s = await scene([a])
		s.loading.set(true)
		vi.advanceTimersByTime(30)
		expect(a.currentFrame()).toBe(0)
		s.loading.set(false)
		vi.advanceTimersByTime(10)
		expect(a.currentFrame()).toBe(1)
		s.destroy()
	})

	it('steps Attached Controllers along with their carrier', async () => {
		const bus = animated('bus', { state: 'pause' })
		const wheel = createConnectedController({
			type: 'wheel',
			base: bus,
			frames,
			offset: { x: 0, y: 0 },
			width: () => 4,
			height: () => 4,
			state: () => 'play',
			frameInterval: () => 20,
		})
		const hubcap = animated('hubcap', { frameInterval: 40 })
		bus.attach(wheel)
		wheel.attach(hubcap)
		const s = await scene([bus])
		vi.advanceTimersByTime(40)
		expect(bus.currentFrame()).toBe(0)
		expect(wheel.currentFrame()).toBe(2)
		expect(hubcap.currentFrame()).toBe(1)
		s.destroy()
	})

	it('steps on the display’s refresh with the display frame clock', async () => {
		// 25 ms Frames on a 16 ms refresh: a step on the first refresh, and
		// then one whenever a Frame is due, timed from when it was due
		const a = animated('a', { frameInterval: 25 })
		const s = await scene([a], { frameClock: 'display' })
		const seen: number[] = []
		for (let refresh = 0; refresh < 8; refresh++) {
			vi.advanceTimersToNextFrame()
			seen.push(a.currentFrame())
		}
		expect(seen).toEqual([1, 1, 2, 2, 3, 0, 0, 1])
		s.destroy()
	})

	it('pauses on the display frame clock under a Modal, Attached Controllers too', async () => {
		const bus = animated('bus', { frameInterval: 20 })
		const wheel = animated('wheel', { frameInterval: 20 })
		bus.attach(wheel)
		const s = await scene([bus], { frameClock: 'display' })
		s.modal.set('paused')
		for (let refresh = 0; refresh < 5; refresh++) vi.advanceTimersToNextFrame()
		expect(bus.currentFrame()).toBe(0)
		expect(wheel.currentFrame()).toBe(0)
		s.modal.set(undefined)
		vi.advanceTimersToNextFrame()
		expect(bus.currentFrame()).toBe(1)
		expect(wheel.currentFrame()).toBe(1)
		s.destroy()
	})
})
