import { type JSX, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	type ControllerBaseType,
	type ControllerProps,
	createConnectedController,
	createController,
} from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import {
	createCanvasPainter,
	maxBackingArea,
	settleMs,
} from '../src/canvasPainter'
import type { Matrix } from '../src/geometry'
import {
	type RecordingContext,
	type State,
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

		it('not after a Tick with the Scene paused, and nothing of the game running', () => {
			loadAll('a')
			const { ctx, scene } = painted(sprite('a'))
			scene.modal.set('paused')
			vi.advanceTimersByTime(10)
			frames.run()
			ctx.reset()
			vi.advanceTimersByTime(30)
			frames.run()
			expect(frames.pending()).toBe(0)
			expect(ctx.calls).toEqual([])
		})

		it("after a paused Tick that runs the game's own Ticker", () => {
			loadAll('a')
			const { ctx, scene } = painted(sprite('a'))
			scene.modal.set('paused')
			scene.tickers.add(() => {})
			vi.advanceTimersByTime(30)
			frames.run()
			ctx.reset()
			vi.advanceTimersByTime(10)
			frames.run()
			expect(ctx.draws).toHaveLength(1)
		})

		it('after a paused Tick that runs afterEnterFrames', () => {
			loadAll('a')
			const { ctx, scene } = paint([sprite('a')], {
				afterEnterFrames: () => {},
			})
			frames.run()
			scene.modal.set('paused')
			vi.advanceTimersByTime(30)
			frames.run()
			ctx.reset()
			vi.advanceTimersByTime(10)
			frames.run()
			expect(ctx.draws).toHaveLength(1)
		})

		it('after the Tick that paused the Scene, with what moved in it', () => {
			loadAll('a')
			const a = createController<ControllerBaseType>({
				frames: ['a.png'],
				init: () => {
					const [x, setX] = createSignal(0)
					return {
						id: 'a',
						type: 'a',
						x,
						setX,
						y: () => 0,
						width: () => 10,
						height: () => 10,
					}
				},
				// Moves on, and on its third Tick ends the game
				onEnterFrame: ({ $, $scene }) => {
					$.setX?.($.x() + 1)
					if ($.x() === 3) $scene.modal.set('game over')
				},
			})
			const { ctx } = painted(a)
			vi.advanceTimersByTime(20)
			frames.run()
			ctx.reset()
			vi.advanceTimersByTime(10)
			frames.run()
			expect(ctx.draws.map((d) => d.state.transform.e)).toEqual([3])
			ctx.reset()
			vi.advanceTimersByTime(10)
			frames.run()
			expect(ctx.calls).toEqual([])
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

		it('after a Frame steps on a part of a part', () => {
			loadAll('carrier', 'arm', 'a', 'b')
			const hand = createController<ControllerBaseType>({
				frames: ['a.png', 'b.png'],
				init: () => ({
					id: 'hand',
					type: 'hand',
					x: () => 0,
					y: () => 0,
					width: () => 10,
					height: () => 10,
					state: () => 'play',
					frameInterval: () => 100,
				}),
			})
			const arm = sprite('arm')
			arm.attach(hand)
			const carrier = sprite('carrier')
			carrier.attach(arm)
			const { ctx } = paint([carrier], { frameClock: 'display' })
			frames.run(0)
			frames.run(50)
			ctx.reset()
			frames.run(100)
			frames.run(116)
			expect(ctx.draws.map((d) => d.image)).toContain('a.png')
		})
	})

	describe('with a Draw Hook', () => {
		/** A Sprite like `sprite`'s, with `draw` as its Draw Hook. */
		function hooked(
			id: string,
			draw: ControllerProps<ControllerBaseType>['draw'],
			options: {
				x?: number
				frames?: string[]
				frame?: number
				style?: JSX.CSSProperties
			} = {},
		) {
			return createController<ControllerBaseType>({
				frames: options.frames ?? [`${id}.png`],
				style: options.style,
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

		describe('reaching past its box, with drawReach', () => {
			/** A 20×10 Sprite at `x` whose Draw Hook says when it ran. */
			function reaching(
				id: string,
				x: number,
				drawReach: ControllerProps<ControllerBaseType>['drawReach'],
				ran: string[],
				xScale = 1,
			) {
				return createController<ControllerBaseType>({
					frames: [`${id}.png`],
					drawReach,
					draw: () => {
						ran.push(id)
					},
					init: () => ({
						id,
						type: id,
						x: () => x,
						y: () => 40,
						width: () => 20,
						height: () => 10,
						xScale: () => xScale,
					}),
				})
			}

			it('painted while what it reaches is in view, though its box is not', () => {
				const ran: string[] = []
				// The view is 0 to 100 across; each box is off its left edge
				paint([
					reaching('none', -30, undefined, ran),
					reaching('right', -30, { right: 15 }, ran),
					reaching('short', -30, { right: 5 }, ran),
					reaching('all', -30, 15, ran),
					reaching('top', -30, { top: 500 }, ran),
				])
				frames.run()
				expect(ran).toEqual(['right', 'all'])
			})

			it('in its own pixels, so its right reaches left when flipped', () => {
				const ran: string[] = []
				// Off the view's right edge, facing left
				paint([
					reaching('flipped', 110, { right: 15 }, ran, -1),
					reaching('unflipped', 110, { right: 15 }, ran),
				])
				frames.run()
				expect(ran).toEqual(['flipped'])
			})

			it('passed on by createConnectedController', () => {
				const ran: string[] = []
				const base = reaching('base', 30, undefined, ran)
				const part = createConnectedController({
					base,
					type: 'part',
					offset: { x: 100, y: 0 },
					width: () => 10,
					height: () => 10,
					drawReach: { left: 50 },
					draw: () => {
						ran.push('part')
					},
				})
				base.attach(part)
				paint([base])
				frames.run()
				expect(ran).toEqual(['base', 'part'])
			})
		})

		it("with its Sprite's image smoothing, for images it draws itself", () => {
			const smoothing: boolean[] = []
			const record = ({ ctx: hookCtx }: { ctx: CanvasRenderingContext2D }) => {
				smoothing.push(hookCtx.imageSmoothingEnabled)
			}
			paint([
				hooked('pixel', record, { style: { 'image-rendering': 'pixelated' } }),
				hooked('photo', record),
			])
			frames.run()
			expect(smoothing).toEqual([false, true])
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

		it('able to draw an image of its own with image(), painted again once it has loaded', () => {
			loadAll('badge')
			const given: unknown[] = []
			const badge = hooked('badge', ({ ctx: hookCtx, image }) => {
				const logo = image('logo.png')
				given.push(logo && { width: logo.width, height: logo.height })
				if (logo) hookCtx.drawImage(logo.image, 2, 3)
			})
			const { ctx } = paint([badge], {
				resolveAsset: (url) => url.replace('logo', 'winter-logo'),
			})
			frames.run()
			expect(given).toEqual([undefined])
			expect(images.requested).toContain('winter-logo.png')
			images.load('winter-logo.png', 6, 4)
			frames.run()
			expect(given).toEqual([undefined, { width: 6, height: 4 }])
			expect(ctx.draws.map((d) => d.image)).toEqual(['winter-logo.png'])
		})

		it('painted again once a web font has loaded, for text it draws in one', () => {
			const fonts = new EventTarget()
			Object.defineProperty(document, 'fonts', {
				value: fonts,
				configurable: true,
			})
			cleanup.push(() => {
				Reflect.deleteProperty(document, 'fonts')
			})
			let painted = 0
			paint([hooked('label', () => painted++)])
			frames.run()
			expect(painted).toBe(1)
			fonts.dispatchEvent(new Event('loadingdone'))
			frames.run()
			expect(painted).toBe(2)
		})

		it('given to an Attached Controller made with createConnectedController', () => {
			loadAll('kart')
			const kart = hooked('kart', () => {})
			let drew = 0
			const wheel = createConnectedController({
				type: 'wheel',
				base: kart,
				// In the middle of the kart, which is turned on its side
				offset: { x: 8, y: 3 },
				width: () => 4,
				height: () => 4,
				draw: ({ ctx: hookCtx }) => {
					drew++
					hookCtx.fillRect(0, 0, 4, 4)
				},
			})
			kart.attach(wheel)
			const { ctx } = paint([kart])
			frames.run()
			expect(drew).toBe(1)
			expect(ctx.methods()).toContain('fillRect')
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

	describe('at its size on the screen, whatever CSS scales it to', () => {
		/**
		 * Shows `canvas` at `scale` times its CSS size, as a transform on it or
		 * on something it's in would: jsdom lays nothing out, so it'd be 0×0.
		 * Gives back a way to change the scale.
		 */
		function scaledBy(canvas: HTMLCanvasElement, scale: number) {
			let now = scale
			vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => {
				const width = Number.parseFloat(canvas.style.width) * now
				const height = Number.parseFloat(canvas.style.height) * now
				return {
					...{ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height },
					...{ width, height, toJSON: () => ({}) },
				}
			})
			return (next: number) => {
				now = next
			}
		}

		/** Every size the backing store's been given, as `width×height`. */
		function backingSizes(canvas: HTMLCanvasElement) {
			const sizes: string[] = []
			const setWidth = vi.spyOn(canvas, 'width', 'set')
			return {
				sizes,
				/** Notes the size, if the width was set since it last did. */
				note() {
					if (setWidth.mock.calls.length > sizes.length) {
						sizes.push(`${canvas.width}×${canvas.height}`)
					}
				},
			}
		}

		/** The window resizing, which repaints the Scene. */
		const resizeWindow = () => window.dispatchEvent(new Event('resize'))

		it('with a backing store that size times devicePixelRatio, in which it paints in its own pixels', () => {
			vi.stubGlobal('devicePixelRatio', 2)
			loadAll('a')
			const { canvas, ctx } = paint([sprite('a', { x: 10, y: 20 })], {
				width: 100,
				height: 50,
				x: 5,
			})
			scaledBy(canvas, 1.5)
			frames.run()
			expect([canvas.width, canvas.height]).toEqual([300, 150])
			// The page still lays it out at the Renderer's size
			expect([canvas.style.width, canvas.style.height]).toEqual([
				'100px',
				'50px',
			])
			expect(rounded(ctx.draws[0].state.transform)).toEqual({
				a: 3,
				b: 0,
				c: 0,
				d: 3,
				e: 15,
				f: 60,
			})
		})

		it("as run-game's stage is, scaled to fit the window", () => {
			loadAll('a')
			const { canvas } = paint([sprite('a')], { width: 960, height: 540 })
			scaledBy(canvas, 1267 / 960)
			frames.run()
			expect([canvas.width, canvas.height]).toEqual([1267, 713])
		})

		it("with a Draw Hook's context in the Sprite's box, in the Renderer's pixels", () => {
			const transforms: Matrix[] = []
			const hooked = createController<ControllerBaseType>({
				frames: ['hook.png'],
				draw: ({ ctx: hookCtx }) => {
					transforms.push(
						(hookCtx as unknown as RecordingContext).state.transform,
					)
				},
				init: () => ({
					...{ id: 'hook', type: 'hook', x: () => 10, y: () => 4 },
					...{ width: () => 20, height: () => 10 },
				}),
			})
			const { canvas } = paint([hooked])
			scaledBy(canvas, 2)
			frames.run()
			expect(transforms.map(rounded)).toEqual([
				{ a: 2, b: 0, c: 0, d: 2, e: 20, f: 8 },
			])
		})

		it('resized at once when that size moves by more than a fifth', () => {
			loadAll('a')
			const { canvas, ctx } = paint([sprite('a')])
			const scale = scaledBy(canvas, 1)
			frames.run()
			expect(canvas.width).toBe(100)
			ctx.reset()
			scale(1.25)
			resizeWindow()
			frames.run()
			expect([canvas.width, canvas.height]).toEqual([125, 125])
			expect(ctx.draws[0].state.transform.a).toBe(1.25)
		})

		it('resized for a smaller move once it has stayed put for a moment', () => {
			loadAll('a')
			const { canvas } = paint([sprite('a')])
			const scale = scaledBy(canvas, 1)
			frames.run()
			scale(1.1)
			resizeWindow()
			frames.run()
			expect(canvas.width).toBe(100)
			vi.advanceTimersByTime(settleMs - 1)
			frames.run()
			expect(canvas.width).toBe(100)
			// Then painted again, though nothing in the Scene has moved
			vi.advanceTimersByTime(1)
			expect(frames.pending()).toBe(1)
			frames.run()
			expect(canvas.width).toBe(110)
		})

		it('not resized every display frame of a zoom animated with scale()', () => {
			loadAll('a')
			const { canvas } = paint([sprite('a')], { width: 960, height: 540 })
			const scale = scaledBy(canvas, 1)
			const backing = backingSizes(canvas)
			frames.run()
			backing.note()
			// From 1× to 3× and back to 2×, over two seconds of display frames
			const zoom = [
				...Array.from({ length: 60 }, (_, i) => 1 + (2 * (i + 1)) / 60),
				...Array.from({ length: 60 }, (_, i) => 3 - (i + 1) / 60),
			]
			for (const step of zoom) {
				scale(step)
				resizeWindow()
				vi.advanceTimersByTime(16)
				frames.run()
				backing.note()
			}
			// Once to start with, then once for each fifth it grew or shrank by,
			// rather than every display frame
			expect(backing.sizes.length).toBeLessThanOrEqual(1 + 6 + 3)
			// Then to exactly its size on the screen, once it's stayed put
			vi.advanceTimersByTime(settleMs)
			frames.run()
			backing.note()
			expect(backing.sizes.at(-1)).toBe('1920×1080')
			expect(backing.sizes.length).toBeLessThanOrEqual(1 + 6 + 3 + 1)
		})

		it("resized exactly, at once, when the screen's density changes", () => {
			loadAll('a')
			const { canvas } = paint([sprite('a')])
			scaledBy(canvas, 1)
			frames.run()
			vi.stubGlobal('devicePixelRatio', 1.1)
			resizeWindow()
			frames.run()
			expect(canvas.width).toBe(110)
		})

		it('at a lower density where it would be bigger than a phone can make a canvas', () => {
			vi.stubGlobal('devicePixelRatio', 3)
			loadAll('a')
			const { canvas, ctx } = paint([sprite('a')], {
				width: 960,
				height: 540,
			})
			scaledBy(canvas, 4)
			frames.run()
			// Not 11,520×6,480, which is 74.6 million pixels
			expect(canvas.width * canvas.height).toBeLessThanOrEqual(maxBackingArea)
			expect([canvas.width, canvas.height]).toEqual([5333, 3000])
			expect(ctx.draws[0].state.transform.a).toBeCloseTo(5333 / 960, 2)
		})

		it("at less than one pixel to one of the Renderer's, if it must", () => {
			loadAll('a')
			const { canvas } = paint([sprite('a')], { width: 8000, height: 4000 })
			scaledBy(canvas, 1)
			frames.run()
			expect(canvas.width * canvas.height).toBeLessThanOrEqual(maxBackingArea)
			expect([canvas.width, canvas.height]).toEqual([5657, 2828])
		})

		it('with drop-shadows as big as on the page', () => {
			loadAll('glow')
			const { canvas, ctx } = paint([
				sprite('glow', {
					style: { filter: 'drop-shadow(2px 3px 4px black)' },
				}),
			])
			scaledBy(canvas, 2)
			frames.run()
			const { shadowOffsetX, shadowOffsetY, shadowBlur } = ctx.draws[0].state
			// The blur twice its length, as a canvas blurs by half shadowBlur
			expect([shadowOffsetX, shadowOffsetY, shadowBlur]).toEqual([4, 6, 16])
		})

		describe('with pixel art on whole pixels of the screen', () => {
			/** Where each image was painted from, in the backing store's pixels. */
			const origins = (ctx: RecordingContext) =>
				ctx.draws.map(({ image, state: { transform } }) => ({
					image,
					x: Math.round(transform.e * 1000) / 1000,
					y: Math.round(transform.f * 1000) / 1000,
				}))

			it('under a pixelated Renderer, or for a pixelated Sprite', () => {
				loadAll('a', 'b')
				const pixelated = paint([sprite('a', { x: 10.3, y: 7 })], {
					pixelated: true,
				})
				const pixelatedSprite = paint([
					sprite('b', {
						x: 10.3,
						y: 7,
						style: { 'image-rendering': 'pixelated' },
					}),
				])
				scaledBy(pixelated.canvas, 1.32)
				scaledBy(pixelatedSprite.canvas, 1.32)
				frames.run()
				// Rather than from (13.596, 9.24)
				expect(origins(pixelated.ctx)).toEqual([
					{ image: 'a.png', x: 14, y: 9 },
				])
				expect(origins(pixelatedSprite.ctx)).toEqual([
					{ image: 'b.png', x: 14, y: 9 },
				])
			})

			it('but not when smoothed, nor when turned', () => {
				loadAll('a', 'b')
				const smooth = paint([sprite('a', { x: 10.3, y: 7 })])
				const turned = paint([sprite('b', { x: 10.3, y: 7, rotation: 45 })], {
					pixelated: true,
				})
				scaledBy(smooth.canvas, 1.32)
				scaledBy(turned.canvas, 1.32)
				frames.run()
				expect(origins(smooth.ctx)).toEqual([
					{ image: 'a.png', x: 13.596, y: 9.24 },
				])
				const [{ x, y }] = origins(turned.ctx)
				expect([x, y]).not.toEqual([Math.round(x), Math.round(y)])
			})
		})

		describe('measured again, though nothing in the Scene has moved', () => {
			/** A canvas on the page, in a Renderer's `<div>`, painted once. */
			function onPage() {
				loadAll('a')
				const painting = paint([sprite('a')])
				const renderer = document.createElement('div')
				const page = document.createElement('main')
				renderer.append(painting.canvas)
				page.append(renderer)
				document.body.append(page)
				cleanup.push(() => page.remove())
				const scale = scaledBy(painting.canvas, 1)
				frames.run()
				return { ...painting, renderer, page, scale }
			}

			it('when a transform on something the canvas is in changes', async () => {
				const { canvas, page, scale } = onPage()
				scale(2)
				page.style.transform = 'scale(2)'
				// A MutationObserver says so once the change has been made
				await Promise.resolve()
				expect(frames.pending()).toBe(1)
				frames.run()
				expect(canvas.width).toBe(200)
			})

			it('when a CSS animation on something it is in finishes, but no other', () => {
				const { renderer, page } = onPage()
				const elsewhere = document.createElement('p')
				page.append(elsewhere)
				elsewhere.dispatchEvent(new Event('transitionend', { bubbles: true }))
				expect(frames.pending()).toBe(0)
				renderer.dispatchEvent(new Event('transitionend', { bubbles: true }))
				expect(frames.pending()).toBe(1)
				frames.run()
				renderer.dispatchEvent(new Event('animationend', { bubbles: true }))
				expect(frames.pending()).toBe(1)
			})
		})
	})

	describe('with the style a canvas can draw', () => {
		/** The state each image was drawn with, by image. */
		const stateOf = (
			ctx: { draws: { image: string; state: State }[] },
			image: string,
		) => ctx.draws.find((d) => d.image === image)?.state

		it('opacity, multiplied through carriers', () => {
			loadAll('ghost', 'sheet', 'chain', 'solid')
			const ghost = sprite('ghost', { style: { opacity: 0.5 } })
			const sheet = sprite('sheet', { style: { opacity: '50%' } })
			sheet.attach(sprite('chain'))
			ghost.attach(sheet)
			const { ctx } = paint([ghost, sprite('solid')])
			frames.run()
			expect(stateOf(ctx, 'ghost.png')?.globalAlpha).toBe(0.5)
			expect(stateOf(ctx, 'sheet.png')?.globalAlpha).toBe(0.25)
			expect(stateOf(ctx, 'chain.png')?.globalAlpha).toBe(0.25)
			expect(stateOf(ctx, 'solid.png')?.globalAlpha).toBe(1)
		})

		it("filter's colour functions, through the context's own filter, its carriers' after its own", () => {
			loadAll('zombie', 'arm', 'plain')
			const zombie = sprite('zombie', {
				style: { filter: 'hue-rotate(0.25turn) brightness(150%) blur(2px)' },
			})
			zombie.attach(
				sprite('arm', { style: { filter: 'sepia(.5) saturate(2)' } }),
			)
			const { ctx } = paint([zombie, sprite('plain')])
			frames.run()
			// blur isn't one a canvas is asked to draw, so it's left out
			expect(stateOf(ctx, 'zombie.png')?.filter).toBe(
				'hue-rotate(90deg) brightness(1.5)',
			)
			expect(stateOf(ctx, 'arm.png')?.filter).toBe(
				'sepia(0.5) saturate(2) hue-rotate(90deg) brightness(1.5)',
			)
			expect(stateOf(ctx, 'plain.png')?.filter).toBe('none')
		})

		it("drop-shadow, through the context's shadow, turned and scaled as its Sprite is", () => {
			vi.stubGlobal('devicePixelRatio', 2)
			loadAll('glow', 'outline', 'plain')
			const { ctx } = paint([
				sprite('glow', {
					rotation: 90,
					style: { filter: 'drop-shadow(2px 3px 4px rgba(0, 0, 0, 0.5))' },
				}),
				sprite('outline', { style: { filter: 'drop-shadow(gold 1px 0)' } }),
				sprite('plain'),
			])
			frames.run()
			const shadow = (image: string) => {
				const state = stateOf(ctx, image)
				return (
					state && {
						filter: state.filter,
						colour: state.shadowColor,
						x: state.shadowOffsetX,
						y: state.shadowOffsetY,
						blur: state.shadowBlur,
					}
				)
			}
			// A canvas's shadow is in the screen's own pixels, whatever the
			// transform, so it's turned 90° and doubled for the density here.
			// Its blur is doubled again, as a canvas blurs by half its
			// shadowBlur, where drop-shadow blurs by all of its length.
			expect(shadow('glow.png')).toEqual({
				filter: 'none',
				colour: 'rgba(0, 0, 0, 0.5)',
				x: -6,
				y: 4,
				blur: 16,
			})
			expect(shadow('outline.png')).toEqual({
				filter: 'none',
				colour: 'gold',
				x: 2,
				y: 0,
				blur: 0,
			})
			expect(shadow('plain.png')).toEqual({
				filter: 'none',
				colour: 'rgba(0, 0, 0, 0)',
				x: 0,
				y: 0,
				blur: 0,
			})
		})

		it('transform, translate and transform-origin, as the page applies them', () => {
			loadAll('squash', 'skewed')
			const { ctx } = paint([
				sprite('squash', {
					x: 20,
					style: {
						transform: 'scale(2, 0.5)',
						'transform-origin': 'left bottom',
						translate: '5px 1px',
					},
				}),
				sprite('skewed', {
					style: {
						transform: 'translateX(10px) skewX(45deg) rotate(0.5turn)',
						'transform-origin': '0 0',
					},
				}),
			])
			frames.run()
			const transformOf = (image: string) =>
				rounded(stateOf(ctx, image)?.transform ?? ({} as Matrix))
			// Squashed onto its bottom edge, which stays where it was, then
			// moved by translate.
			expect(transformOf('squash.png')).toEqual({
				a: 2,
				b: 0,
				c: 0,
				d: 0.5,
				e: 25,
				f: 6,
			})
			expect(transformOf('skewed.png')).toEqual({
				a: -1,
				b: 0,
				c: -1,
				d: -1,
				e: 10,
				f: 0,
			})
		})

		describe('on a context without filter, as on WebKit', () => {
			beforeEach(() => {
				contexts = recordCanvases({ filter: false })
			})

			/** How many times any image has been recoloured. */
			const recolourings = () =>
				contexts.flatMap((c) => c.methods()).filter((m) => m === 'getImageData')
					.length

			it('with colour filters recoloured into a copy of the Frame, each step clamped', () => {
				images.load('zombie.png', 10, 10, [200, 100, 50, 255])
				images.load('sepia.png', 10, 10)
				images.load('turned.png', 10, 10, [255, 0, 0, 255])
				const { ctx } = paint([
					sprite('zombie', {
						style: {
							filter: 'brightness(2) saturate(0) drop-shadow(1px 1px red)',
						},
					}),
					sprite('sepia', { style: { filter: 'sepia(1)' } }),
					sprite('turned', { style: { filter: 'hue-rotate(120deg)' } }),
				])
				frames.run()
				// Worked from the Filter Effects spec's matrices: doubled to
				// (255, 200, 100) once clamped, then grey by luminance.
				expect(
					ctx.draws.map(({ image, colour }) => ({ image, colour })),
				).toEqual([
					{ image: 'zombie.png', colour: [205, 205, 205, 255] },
					{ image: 'sepia.png', colour: [255, 255, 239, 255] },
					{ image: 'turned.png', colour: [0, 113, 0, 255] },
				])
				const zombie = stateOf(ctx, 'zombie.png')
				expect([zombie?.filter, zombie?.shadowColor]).toEqual(['none', 'red'])
			})

			it('with grayscale, wholly or partly, more than 100% being 100%', () => {
				images.load('grey.png', 10, 10, [200, 100, 50, 255])
				images.load('half.png', 10, 10, [200, 100, 50, 255])
				const { ctx } = paint([
					sprite('grey', { style: { filter: 'grayscale(150%)' } }),
					sprite('half', { style: { filter: 'grayscale(0.5)' } }),
				])
				frames.run()
				// From the Filter Effects spec's matrix: 0.2126 red, 0.7152
				// green and 0.0722 blue, all grey at 1, halfway at 0.5
				expect(ctx.draws.map(({ colour }) => colour)).toEqual([
					[118, 118, 118, 255],
					[159, 109, 84, 255],
				])
			})

			it('once for each value rounded, to a whole degree for hue and 0.01 for the rest', () => {
				loadAll('a')
				const { ctx } = paint([
					sprite('a', {
						style: { filter: 'hue-rotate(10.2deg) brightness(1.004)' },
					}),
					sprite('a', {
						style: { filter: 'hue-rotate(9.8deg) brightness(0.996)' },
					}),
					sprite('a', {
						style: { filter: 'hue-rotate(10deg) brightness(1.02)' },
					}),
				])
				frames.run()
				expect(ctx.draws).toHaveLength(3)
				expect(recolourings()).toBe(2)
				ctx.reset()
				vi.advanceTimersByTime(10)
				frames.run()
				expect(ctx.draws).toHaveLength(3)
				expect(recolourings()).toBe(2)
			})

			it('without keeping every copy an animated filter has made', () => {
				loadAll('a')
				const [brightness, setBrightness] = createSignal(1)
				const pulsing = createController<ControllerBaseType>({
					frames: ['a.png'],
					init: () => ({
						id: 'a',
						type: 'a',
						x: () => 0,
						y: () => 0,
						width: () => 10,
						height: () => 10,
						style: () => ({ filter: `brightness(${brightness()})` }),
					}),
				})
				paint([pulsing])
				frames.run()
				for (let step = 1; step <= 1000; step++) {
					setBrightness(1 + step / 100)
					vi.advanceTimersByTime(10)
					frames.run()
				}
				expect(recolourings()).toBe(1001)
				setBrightness(1)
				vi.advanceTimersByTime(10)
				frames.run()
				expect(recolourings()).toBe(1002)
			})
		})

		it('image-rendering, turning smoothing off for pixelated and crisp-edges, which its parts inherit unless they say otherwise', () => {
			loadAll('tree', 'leaf', 'fruit', 'rock', 'cloud', 'plain')
			const tree = sprite('tree', { style: { 'image-rendering': 'pixelated' } })
			tree.attach(sprite('leaf'))
			tree.attach(sprite('fruit', { style: { 'image-rendering': 'auto' } }))
			const { ctx } = paint([
				tree,
				sprite('rock', { style: { 'image-rendering': 'crisp-edges' } }),
				sprite('cloud', { style: { 'image-rendering': 'smooth' } }),
				// Painted after one that's pixelated, which isn't left set for it
				sprite('plain'),
			])
			frames.run()
			expect(
				ctx.draws.map(({ image, state }) => [
					image,
					state.imageSmoothingEnabled,
				]),
			).toEqual([
				['tree.png', false],
				['leaf.png', false],
				['fruit.png', true],
				['rock.png', false],
				['cloud.png', true],
				['plain.png', true],
			])
		})

		it("image-rendering: auto and smooth leaving smoothing to the Renderer's pixelated", () => {
			loadAll('auto', 'smooth')
			const { ctx } = paint(
				[
					sprite('auto', { style: { 'image-rendering': 'auto' } }),
					sprite('smooth', { style: { 'image-rendering': 'smooth' } }),
				],
				{ pixelated: true },
			)
			frames.run()
			expect(ctx.draws.map((d) => d.state.imageSmoothingEnabled)).toEqual([
				false,
				false,
			])
		})

		it('nothing for visibility: hidden, which its parts inherit unless they say visible', () => {
			loadAll('cloak', 'pin', 'badge', 'shown')
			const cloak = sprite('cloak', { style: { visibility: 'hidden' } })
			cloak.attach(sprite('pin'))
			cloak.attach(sprite('badge', { style: { visibility: 'visible' } }))
			const { ctx } = paint([cloak, sprite('shown')])
			frames.run()
			expect(ctx.draws.map((d) => d.image)).toEqual(['badge.png', 'shown.png'])
		})

		it('nothing for display: none, nor for anything it carries', () => {
			loadAll('van', 'wheel', 'driver', 'hat', 'shown')
			const van = sprite('van', { style: { display: 'none' } })
			const driver = sprite('driver', { style: { visibility: 'visible' } })
			driver.attach(sprite('hat'))
			van.attach(sprite('wheel'))
			van.attach(driver)
			const { ctx } = paint([
				van,
				sprite('shown', { style: { display: 'block' } }),
			])
			frames.run()
			expect(ctx.draws.map((d) => d.image)).toEqual(['shown.png'])
		})
	})
})
