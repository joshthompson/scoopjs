import { type JSX, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	type ControllerBaseType,
	type ControllerProps,
	createController,
} from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import { createCanvasPainter } from '../src/canvasPainter'
import type { Matrix } from '../src/geometry'
import {
	type RecordingContext,
	fakeImages,
	recordCanvases,
	stubAnimationFrames,
} from './helpers/canvas'

/** A Sprite at (x, y), its size and Frames as given, that a test can move. */
function sprite(
	id: string,
	options: {
		x?: number
		y?: number
		width?: number
		height?: number
		frames?: string[]
		type?: string
		style?: JSX.CSSProperties
		rotation?: number
		parallax?: number
		innerRotation?: number
	} = {},
) {
	return createController<ControllerBaseType>({
		frames: options.frames ?? [`${id}.png`],
		style: options.style,
		init: () => {
			const [x, setX] = createSignal(options.x ?? 0)
			const [y, setY] = createSignal(options.y ?? 0)
			return {
				id,
				type: options.type ?? id,
				x,
				y,
				setX,
				setY,
				width: () => options.width ?? 10,
				height: () => options.height ?? 10,
				rotation: () => options.rotation ?? 0,
				parallax: () => options.parallax ?? 1,
				inner: { rotation: () => options.innerRotation ?? 0 },
			}
		},
	})
}

type AnyController = ReturnType<typeof sprite>

/** A transform rounded, so a test can compare it with whole numbers. */
function rounded(m: Matrix): Matrix {
	const round = (n: number) => Math.round(n * 1e6) / 1e6 + 0
	return {
		a: round(m.a),
		b: round(m.b),
		c: round(m.c),
		d: round(m.d),
		e: round(m.e),
		f: round(m.f),
	}
}

describe('the Canvas Renderer paints', () => {
	let contexts: ReturnType<typeof recordCanvases>
	let frames: ReturnType<typeof stubAnimationFrames>
	let images: ReturnType<typeof fakeImages>
	let cleanup: (() => void)[]

	beforeEach(() => {
		vi.useFakeTimers()
		contexts = recordCanvases()
		frames = stubAnimationFrames()
		images = fakeImages()
		cleanup = []
	})

	afterEach(() => {
		for (const done of cleanup) done()
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	/**
	 * A Scene with `controllers` in it, painted onto a fresh `<canvas>`. Gives
	 * back the context it paints on.
	 */
	function paint(
		controllers: AnyController[],
		options: Partial<SceneOptions> & { pixelated?: boolean } = {},
	) {
		const scene = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			...options,
			setup: (s) => s.addController(...controllers),
		})
		// jsdom never loads the images a Scene preloads, so it'd be loading,
		// and paused, for ever.
		scene.loading.set(false)
		const canvas = document.createElement('canvas')
		const painter = createCanvasPainter({
			scene,
			canvas,
			pixelated: () => options.pixelated ?? false,
			loadImage: images.loader,
		})
		cleanup.push(
			() => painter.dispose(),
			() => scene.destroy(),
		)
		const ctx = contexts[contexts.length - 1]
		return { scene, canvas, ctx }
	}

	it('a Frame stretched to its Sprite, where the camera sees it', () => {
		images.load('a.png', 4, 2)
		const { ctx } = paint(
			[sprite('a', { x: 30, y: 40, width: 20, height: 10 })],
			{
				x: 5,
				y: 10,
			},
		)
		frames.run()
		expect(ctx.draws).toHaveLength(1)
		const [draw] = ctx.draws
		expect(draw.image).toBe('a.png')
		expect(draw.source).toEqual({ x: 0, y: 0, width: 4, height: 2 })
		expect(draw.dest).toEqual({ x: 0, y: 0, width: 20, height: 10 })
		expect(rounded(draw.state.transform)).toEqual({
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: 25,
			f: 30,
		})
	})

	/** Loads `url` for each of `ids`, all at 10×10. */
	const loadAll = (...ids: string[]) => {
		for (const id of ids) images.load(`${id}.png`, 10, 10)
	}

	it('in assetOrder, then the order they were added, parts after their carrier', () => {
		loadAll('ground', 'hud', 'p1', 'hat', 'wheel', 'p2')
		const p1 = sprite('p1', { type: 'player' })
		p1.attach(sprite('hat'))
		p1.attach(sprite('wheel'))
		const p2 = sprite('p2', { type: 'player' })
		const { ctx } = paint([p1, sprite('hud'), p2, sprite('ground')], {
			assetOrder: ['hud', 'ground'],
		})
		frames.run()
		expect(ctx.draws.map((d) => d.image)).toEqual([
			'ground.png',
			'hud.png',
			'p1.png',
			'hat.png',
			'wheel.png',
			'p2.png',
		])
	})

	it("reordered by z-index, among Sprites and among a carrier's parts", () => {
		loadAll('a', 'b', 'cloud', 'bolt1', 'bolt2')
		const cloud = sprite('cloud', { style: { 'z-index': 2 } })
		cloud.attach(sprite('bolt1'))
		cloud.attach(sprite('bolt2', { style: { 'z-index': -1 } }))
		const { ctx } = paint([cloud, sprite('a'), sprite('b')])
		frames.run()
		expect(ctx.draws.map((d) => d.image)).toEqual([
			'a.png',
			'b.png',
			'bolt2.png',
			'cloud.png',
			'bolt1.png',
		])
	})

	describe('transformed', () => {
		const transformOf = (
			ctx: { draws: { image: string; state: { transform: Matrix } }[] },
			image: string,
		) =>
			rounded(
				ctx.draws.find((d) => d.image === image)?.state.transform ??
					({} as Matrix),
			)

		it('with Attached Controllers composed through their carrier', () => {
			loadAll('arm', 'hand')
			const arm = sprite('arm', {
				x: 10,
				y: 20,
				width: 20,
				height: 20,
				rotation: 90,
			})
			arm.attach(sprite('hand', { x: 5, y: 0, width: 4, height: 4 }))
			const { ctx } = paint([arm])
			frames.run()
			expect(transformOf(ctx, 'arm.png')).toEqual({
				a: 0,
				b: 1,
				c: -1,
				d: 0,
				e: 30,
				f: 20,
			})
			expect(transformOf(ctx, 'hand.png')).toEqual({
				a: 0,
				b: 1,
				c: -1,
				d: 0,
				e: 30,
				f: 25,
			})
		})

		it('with only the Frame turned by inner.rotation, about its middle', () => {
			loadAll('fin')
			const { ctx } = paint([
				sprite('fin', { width: 20, height: 10, innerRotation: 90 }),
			])
			frames.run()
			expect(transformOf(ctx, 'fin.png')).toEqual({
				a: 0,
				b: 1,
				c: -1,
				d: 0,
				e: 15,
				f: -5,
			})
		})

		it('with parallax moving a Sprite less than the camera', () => {
			loadAll('hill')
			const { ctx } = paint([sprite('hill', { x: 50, parallax: 0.5 })], {
				x: 40,
			})
			frames.run()
			expect(transformOf(ctx, 'hill.png').e).toBe(30)
		})
	})

	describe('sprite sheets cropped as the DOM Renderer crops them', () => {
		/** Where each piece of the sheet went, for a 16×16 Sprite showing `frame`. */
		function pieces(frame: string) {
			images.load('sheet.png', 32, 8)
			const { ctx } = paint([
				sprite('s', { width: 16, height: 16, frames: [frame] }),
			])
			frames.run()
			return ctx.draws.map(({ image, source, dest }) => ({
				image,
				source,
				dest,
			}))
		}

		it("with the sheet scaled to the Sprite's height, offsets in display pixels", () => {
			// The sheet is shown at 64×16, so 32 display pixels in is 16 on the sheet
			expect(pieces('sheet.png#-32,0,16,16')).toEqual([
				{
					image: 'sheet.png',
					source: { x: 16, y: 0, width: 8, height: 8 },
					dest: { x: 0, y: 0, width: 16, height: 16 },
				},
			])
		})

		it('with offsets wrapping round the sheet', () => {
			expect(pieces('sheet.png#-96,0,16,16')).toEqual(
				pieces('sheet.png#-32,0,16,16'),
			)
		})

		it('with a positive offset showing the end of the sheet before its start', () => {
			expect(pieces('sheet.png#8,0,16,16')).toEqual([
				{
					image: 'sheet.png',
					source: { x: 28, y: 0, width: 4, height: 8 },
					dest: { x: 0, y: 0, width: 8, height: 16 },
				},
				{
					image: 'sheet.png',
					source: { x: 0, y: 0, width: 4, height: 8 },
					dest: { x: 8, y: 0, width: 8, height: 16 },
				},
			])
		})

		it('with negative offsets for sheets with gutters, wrapping downwards too', () => {
			expect(pieces('sheet.png#-2,-2,16,16')).toEqual([
				{
					image: 'sheet.png',
					source: { x: 1, y: 1, width: 8, height: 7 },
					dest: { x: 0, y: 0, width: 16, height: 14 },
				},
				{
					image: 'sheet.png',
					source: { x: 1, y: 0, width: 8, height: 1 },
					dest: { x: 0, y: 14, width: 16, height: 2 },
				},
			])
		})

		it("through the Scene's Asset Resolver", () => {
			images.load('winter.png', 10, 10)
			const { ctx } = paint([sprite('tree', { frames: ['summer.png'] })], {
				resolveAsset: (url) => url.replace('summer', 'winter'),
			})
			frames.run()
			expect(ctx.draws.map((d) => d.image)).toEqual(['winter.png'])
		})
	})

	it('nothing for Sprites outside the view, but their parts that are in it', () => {
		loadAll('left', 'right', 'edge', 'below', 'crane', 'hook')
		// The view is 100×100, with the camera at (50, 0)
		const crane = sprite('crane', { x: 200, y: 0 })
		crane.attach(sprite('hook', { x: -60, y: 0 }))
		const { ctx } = paint(
			[
				sprite('left', { x: 30 }),
				sprite('right', { x: 160 }),
				sprite('edge', { x: 145 }),
				sprite('below', { x: 60, y: 100 }),
				crane,
			],
			{ x: 50 },
		)
		frames.run()
		expect(ctx.draws.map((d) => d.image)).toEqual(['edge.png', 'hook.png'])
	})

	it('nothing for a Sprite with no Frames, or a Frame past its last', () => {
		loadAll('a', 'b')
		const { ctx } = paint([
			sprite('a', { frames: [] }),
			createController<ControllerBaseType>({
				frames: ['b.png'],
				init: () => ({
					id: 'b',
					type: 'b',
					x: () => 0,
					y: () => 0,
					width: () => 10,
					height: () => 10,
					frame: () => 3,
				}),
			}),
		])
		frames.run()
		expect(ctx.draws).toEqual([])
	})

	describe('again only once something has changed', () => {
		/** Painted once already, and the record of it cleared. */
		function painted(...controllers: AnyController[]) {
			const painting = paint(controllers)
			frames.run()
			painting.ctx.reset()
			return painting
		}

		it('not when nothing has', () => {
			loadAll('a')
			const { ctx } = painted(sprite('a'))
			frames.run()
			expect(frames.pending()).toBe(0)
			expect(ctx.calls).toEqual([])
		})

		it('after a Tick, once however many Ticks came first', () => {
			loadAll('a')
			const a = sprite('a')
			const { ctx } = painted(a)
			a.data.setX?.(5)
			vi.advanceTimersByTime(30)
			frames.run()
			expect(ctx.methods().filter((m) => m === 'clearRect')).toHaveLength(1)
			expect(ctx.draws.map((d) => d.state.transform.e)).toEqual([5])
		})

		it('after a Ticker runs, as it does with the Scene paused', () => {
			loadAll('a')
			const { ctx, scene } = painted(sprite('a'))
			scene.modal.set('paused')
			vi.advanceTimersByTime(10)
			frames.run()
			expect(ctx.draws).toHaveLength(1)
		})

		it('after the camera moves', () => {
			loadAll('a')
			const { ctx, scene } = painted(sprite('a', { x: 10 }))
			scene.canvas.get().setX(4)
			frames.run()
			expect(ctx.draws.map((d) => d.state.transform.e)).toEqual([6])
		})

		it('after an image loads', () => {
			const { ctx } = painted(sprite('a'))
			expect(images.requested).toEqual(['a.png'])
			images.load('a.png', 10, 10)
			frames.run()
			expect(ctx.draws.map((d) => d.image)).toEqual(['a.png'])
		})

		it("after a Frame steps on the display's own clock", () => {
			loadAll('a', 'b')
			const flipper = createController<ControllerBaseType>({
				frames: ['a.png', 'b.png'],
				init: () => ({
					id: 'flipper',
					type: 'flipper',
					x: () => 0,
					y: () => 0,
					width: () => 10,
					height: () => 10,
					state: () => 'play',
					frameInterval: () => 100,
				}),
			})
			const { ctx } = paint([flipper], { frameClock: 'display' })
			// It steps as soon as it starts, to b, and then every 100ms
			frames.run(0)
			frames.run(50)
			expect(ctx.draws.map((d) => d.image)).toEqual(['b.png'])
			ctx.reset()
			frames.run(100)
			frames.run(116)
			expect(ctx.draws.map((d) => d.image)).toEqual(['a.png'])
		})
	})

	describe('with a Draw Hook', () => {
		/** A Sprite like `sprite`'s, with `draw` as its Draw Hook. */
		function hooked(
			id: string,
			draw: ControllerProps<ControllerBaseType>['draw'],
			options: { x?: number; frames?: string[]; frame?: number } = {},
		) {
			return createController<ControllerBaseType>({
				frames: options.frames ?? [`${id}.png`],
				draw,
				init: () => ({
					id,
					type: id,
					x: () => options.x ?? 0,
					y: () => 0,
					width: () => 20,
					height: () => 10,
					rotation: () => 90,
					frame: () => options.frame,
				}),
			})
		}

		it("given a context already in the Sprite's box", () => {
			loadAll('box')
			const transforms: Matrix[] = []
			const { ctx } = paint(
				[
					hooked('box', ({ ctx: hookCtx }) => {
						transforms.push(
							(hookCtx as unknown as RecordingContext).state.transform,
						)
					}),
				],
				{ x: 5 },
			)
			frames.run()
			// The same transform the Frame would have been painted with
			expect(transforms.map(rounded)).toEqual([
				{ a: 0, b: 1, c: -1, d: 0, e: 10, f: -5 },
			])
			expect(ctx.draws).toEqual([])
		})

		it('able to paint the current Frame with drawDefault(), then draw over it', () => {
			loadAll('a', 'b')
			const seen: unknown[] = []
			const flag = hooked(
				'flag',
				({ ctx: hookCtx, drawDefault, $, $scene, $currentFrame }) => {
					seen.push({ id: $.id, scene: $scene.id, $currentFrame })
					drawDefault()
					hookCtx.fillRect(0, 0, 20, 2)
				},
				{ frames: ['a.png', 'b.png'], frame: 1 },
			)
			const { ctx } = paint([flag])
			frames.run()
			expect(seen).toEqual([{ id: 'flag', scene: 'test', $currentFrame: 1 }])
			expect(ctx.draws.map(({ image, dest }) => ({ image, dest }))).toEqual([
				{ image: 'b.png', dest: { x: 0, y: 0, width: 20, height: 10 } },
			])
			expect(rounded(ctx.draws[0].state.transform)).toEqual({
				a: 0,
				b: 1,
				c: -1,
				d: 0,
				e: 15,
				f: -5,
			})
			expect(ctx.methods().slice(-3)).toEqual([
				'drawImage',
				'fillRect',
				'restore',
			])
		})

		it('with its Attached Controllers painted after it, untouched by what it set', () => {
			loadAll('rider', 'sun')
			const kart = hooked('kart', ({ ctx: hookCtx }) => {
				hookCtx.globalAlpha = 0.2
				hookCtx.translate(100, 100)
				hookCtx.fillRect(0, 0, 20, 10)
			})
			kart.attach(sprite('rider'))
			const { ctx } = paint([kart, sprite('sun', { x: 50 })])
			frames.run()
			expect(
				ctx.methods().filter((m) => m === 'fillRect' || m === 'drawImage'),
			).toEqual(['fillRect', 'drawImage', 'drawImage'])
			expect(
				ctx.draws.map(({ image, state }) => ({
					image,
					alpha: state.globalAlpha,
					transform: rounded(state.transform),
				})),
			).toEqual([
				{
					image: 'rider.png',
					alpha: 1,
					transform: { a: 0, b: 1, c: -1, d: 0, e: 15, f: -5 },
				},
				{
					image: 'sun.png',
					alpha: 1,
					transform: { a: 1, b: 0, c: 0, d: 1, e: 50, f: 0 },
				},
			])
		})
	})

	describe("at the screen's pixel density", () => {
		it("with a backing store the Renderer's size times devicePixelRatio", () => {
			vi.stubGlobal('devicePixelRatio', 2)
			loadAll('a')
			const { canvas, ctx } = paint([sprite('a', { x: 10 })], {
				width: 100,
				height: 50,
				x: 5,
			})
			frames.run()
			expect([canvas.width, canvas.height]).toEqual([200, 100])
			expect([canvas.style.width, canvas.style.height]).toEqual([
				'100px',
				'50px',
			])
			expect(rounded(ctx.draws[0].state.transform)).toEqual({
				a: 2,
				b: 0,
				c: 0,
				d: 2,
				e: 10,
				f: 0,
			})
		})

		it('resized, and painted again, with the Renderer', () => {
			vi.stubGlobal('devicePixelRatio', 2)
			loadAll('a')
			const { canvas, ctx, scene } = paint([sprite('a')])
			frames.run()
			ctx.reset()
			scene.setWidth(120)
			frames.run()
			expect(canvas.width).toBe(240)
			expect(canvas.style.width).toBe('120px')
			expect(ctx.draws).toHaveLength(1)
		})

		it('smoothed unless pixelated', () => {
			loadAll('a')
			const smooth = paint([sprite('a')])
			const pixelated = paint([sprite('a')], { pixelated: true })
			frames.run()
			expect(smooth.ctx.draws[0].state.imageSmoothingEnabled).toBe(true)
			expect(pixelated.ctx.draws[0].state.imageSmoothingEnabled).toBe(false)
		})
	})
})
