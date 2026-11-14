import { type JSX, createSignal } from 'solid-js'
import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import {
	type ControllerBaseType,
	type ControllerProps,
	createConnectedController,
	createController,
} from '../src/Controller'
import { Scene, type SceneOptions } from '../src/Scene'
import { createCanvasPainter } from '../src/canvasPainter'
// This file's own text, to find which line a Controller was created on
import thisFile from './canvasIssues.test.ts?raw'
import {
	fakeImages,
	recordCanvases,
	stubAnimationFrames,
} from './helpers/canvas'

/** A 10×10 Sprite at (x, y), with whatever a test asks it for. */
function sprite(
	id: string,
	options: {
		type?: string
		x?: number
		class?: string
		style?: JSX.CSSProperties
		innerStyle?: JSX.CSSProperties
		children?: () => JSX.Element
		frames?: string[]
		draw?: ControllerProps<ControllerBaseType>['draw']
		onMount?: ControllerProps<ControllerBaseType>['onMount']
	} = {},
) {
	return createController<ControllerBaseType>({
		frames: options.frames ?? [`${id}.png`],
		class: options.class,
		style: options.style,
		draw: options.draw,
		onMount: options.onMount,
		init: () => {
			const [x, setX] = createSignal(options.x ?? 0)
			const [y, setY] = createSignal(0)
			return {
				id,
				type: options.type ?? id,
				x,
				y,
				setX,
				setY,
				width: () => 10,
				height: () => 10,
				children: options.children,
				inner: options.innerStyle
					? { style: () => options.innerStyle ?? {} }
					: undefined,
			}
		},
	})
}

type AnyController = ReturnType<typeof sprite>

describe('Canvas Issues', () => {
	let frames: ReturnType<typeof stubAnimationFrames>
	let images: ReturnType<typeof fakeImages>
	let errors: MockInstance<typeof console.error>
	let cleanup: (() => void)[]

	beforeEach(() => {
		vi.useFakeTimers()
		recordCanvases()
		frames = stubAnimationFrames()
		images = fakeImages()
		errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		cleanup = []
	})

	afterEach(() => {
		for (const done of cleanup) done()
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	/** A Scene with `controllers` in it, painted by the Canvas Renderer. */
	function paint(
		controllers: AnyController[],
		options: Partial<SceneOptions> = {},
	) {
		const scene = new Scene('test', {
			width: 100,
			height: 100,
			frameRate: 10,
			...options,
			setup: (s) => s.addController(...controllers),
		})
		scene.loading.set(false)
		const painter = createCanvasPainter({
			scene,
			canvas: document.createElement('canvas'),
			loadImage: images.loader,
		})
		cleanup.push(
			() => painter.dispose(),
			() => scene.destroy(),
		)
		frames.run()
		return scene
	}

	/** Everything logged with console.error, each call as one string. */
	const logged = () => errors.mock.calls.map((args) => args.join(' '))

	it('are reported with console.error, naming the feature, type and an example id', () => {
		paint([sprite('branch-12', { type: 'branch', class: 'leafy' })])
		expect(logged()).toHaveLength(1)
		expect(logged()[0].split('\n')[0]).toBe(
			'[scoopjs:canvas] unsupported class on type "branch" (id "branch-12")',
		)
	})

	it('once per Controller type and feature, never per instance or per Tick', () => {
		paint([
			sprite('branch-1', { type: 'branch', class: 'leafy' }),
			sprite('branch-2', { type: 'branch', class: 'leafy' }),
			sprite('rock-1', { type: 'rock', class: 'mossy' }),
		])
		vi.advanceTimersByTime(50)
		frames.run()
		expect(logged().map((line) => line.split('\n')[0])).toEqual([
			'[scoopjs:canvas] unsupported class on type "branch" (id "branch-1")',
			'[scoopjs:canvas] unsupported class on type "rock" (id "rock-1")',
		])
	})

	it("the first time they're drawn, not while out of view", () => {
		const far = sprite('far', { x: 500, class: 'leafy' })
		paint([far])
		expect(logged()).toEqual([])
		far.data.setX?.(50)
		vi.advanceTimersByTime(10)
		frames.run()
		expect(logged()).toHaveLength(1)
	})

	it('as records from scene.canvasIssues(), the same as the console says', () => {
		const scene = paint([
			sprite('branch-12', {
				type: 'branch',
				style: { 'clip-path': 'circle()', opacity: 0.5 },
			}),
		])
		const issues = scene.canvasIssues()
		expect(issues).toEqual([
			{
				feature: 'style.clip-path',
				type: 'branch',
				id: 'branch-12',
				createdAt: expect.stringMatching(/canvasIssues\.test\.ts:\d+$/),
				fix: expect.any(String),
			},
		])
		expect(JSON.parse(JSON.stringify(issues))).toEqual(issues)
		const [issue] = issues
		expect(logged()).toEqual([
			[
				'[scoopjs:canvas] unsupported style.clip-path on type "branch" (id "branch-12")',
				`  created at ${issue.createdAt}`,
				`  fix: ${issue.fix}`,
			].join('\n'),
		])
	})

	it('as nothing at all from scene.canvasIssues() before any', () => {
		expect(paint([sprite('plain')]).canvasIssues()).toEqual([])
	})

	describe('saying where the Controller was created', () => {
		/** The line of this file that `text` is first on, counting from 1. */
		const lineOf = (text: string) =>
			thisFile.split('\n').findIndex((line) => line.includes(text)) + 1

		it('as the file and line that called createController', () => {
			const scene = paint([sprite('branch-12', { class: 'leafy' })])
			const line = lineOf('return createController<ControllerBaseType>({')
			const [issue] = scene.canvasIssues()
			expect(issue.createdAt).toMatch(
				new RegExp(`test/canvasIssues\\.test\\.ts:${line}$`),
			)
			expect(logged()[0].split('\n')[1]).toBe(`  created at ${issue.createdAt}`)
		})

		it("past ScoopJS's own code, such as createConnectedController", () => {
			const carrier = sprite('carrier')
			const hat = createConnectedController({
				type: 'hat',
				base: carrier,
				offset: { x: 0, y: 0 },
				width: () => 10,
				height: () => 10,
				style: () => ({ 'clip-path': 'circle()' }),
			})
			carrier.attach(hat)
			const scene = paint([carrier])
			const [issue] = scene.canvasIssues()
			expect(issue.createdAt).toMatch(
				new RegExp(
					`test/canvasIssues\\.test\\.ts:${lineOf('const hat = createConnectedController(')}$`,
				),
			)
		})
	})

	/** Each issue reported, as feature and fix. */
	const reported = (scene: Scene) =>
		scene.canvasIssues().map(({ feature, fix }) => ({ feature, fix }))

	describe('for each feature', () => {
		it('children', () => {
			const scene = paint([sprite('a', { children: () => 'hello' })])
			expect(reported(scene)).toEqual([
				{ feature: 'children', fix: 'draw it in a Draw Hook' },
			])
		})

		it("not children while the Scene's skipChildren bench switch is on", () => {
			const scene = paint([sprite('a', { children: () => 'hello' })], {
				skipChildren: true,
			})
			expect(scene.canvasIssues()).toEqual([])
		})

		it('inner.style', () => {
			const scene = paint([
				sprite('a', { innerStyle: { 'background-size': 'contain' } }),
			])
			expect(reported(scene).map((issue) => issue.feature)).toEqual([
				'inner.style',
			])
		})

		it('not inner.style with nothing in it', () => {
			const scene = paint([sprite('a', { innerStyle: { filter: undefined } })])
			expect(scene.canvasIssues()).toEqual([])
		})

		it('each untranslatable style key, but none a canvas draws', () => {
			const scene = paint([
				sprite('a', {
					style: {
						opacity: 0.5,
						'z-index': 2,
						transform: 'scale(2)',
						filter: 'sepia(1)',
						transition: 'opacity 1s',
						'border-radius': '50%',
						'--glow': 'red',
					},
				}),
			])
			expect(reported(scene)).toEqual([
				{
					feature: 'style.transition',
					fix: 'tween the value over Ticks in onEnterFrame instead',
				},
				{
					feature: 'style.border-radius',
					fix: 'clip to a rounded rectangle in a Draw Hook',
				},
				{
					feature: 'style.--glow',
					fix: 'custom properties only reach children and classes: draw what reads it in a Draw Hook',
				},
			])
		})

		it('each filter function outside the supported set', () => {
			const scene = paint([
				sprite('a', {
					style: {
						filter: 'sepia(1) blur(2px) opacity(50%) hue-rotate(90deg)',
					},
				}),
			])
			expect(reported(scene)).toEqual([
				{ feature: 'style.filter blur()', fix: 'draw it in a Draw Hook' },
				{
					feature: 'style.filter opacity()',
					fix: 'use style.opacity, which is translated',
				},
			])
		})

		it('not style keys left without a value, as the page leaves them out', () => {
			const scene = paint([
				sprite('a', { style: { 'clip-path': undefined, 'border-radius': '' } }),
			])
			expect(scene.canvasIssues()).toEqual([])
		})

		it('each filter function whose arguments it cannot read', () => {
			const scene = paint([
				sprite('a', {
					type: 'a',
					style: {
						filter:
							'hue-rotate(30deg) brightness(-1) drop-shadow(1em 1em) contrast(2) url(#glow)',
					},
				}),
			])
			expect(reported(scene).map((issue) => issue.feature)).toEqual([
				'style.filter brightness()',
				'style.filter drop-shadow()',
				'style.filter contrast()',
				'style.filter url()',
			])
		})

		it('any drop-shadow after the first, since a canvas casts only one', () => {
			const scene = paint([
				sprite('a', {
					style: {
						filter: 'drop-shadow(1px 0 white) drop-shadow(-1px 0 white)',
					},
				}),
			])
			expect(reported(scene)).toEqual([
				{
					feature: 'style.filter drop-shadow()',
					fix: 'a canvas casts one drop-shadow, its lengths in px: keep one, or draw the rest in a Draw Hook',
				},
			])
		})

		it('a filter it cannot read at all, as it is written, but not none', () => {
			const scene = paint([
				sprite('a', { style: { filter: 'sepia(1) glow' } }),
				sprite('b', { style: { filter: 'none' } }),
			])
			expect(reported(scene).map((issue) => issue.feature)).toEqual([
				'style.filter glow',
			])
		})

		it('each transform function outside the supported set', () => {
			const scene = paint([
				sprite('a', {
					style: {
						transform: 'rotate(10deg) matrix(1, 0, 0, 1, 5, 5) rotateX(45deg)',
					},
				}),
			])
			expect(reported(scene).map((issue) => issue.feature)).toEqual([
				'style.transform matrix()',
				'style.transform rotateX()',
			])
		})

		it('each translated style key whose value it cannot read, with the value', () => {
			const scene = paint([
				sprite('a', {
					style: {
						translate: '1em 2em',
						opacity: 'var(--o)',
						'transform-origin': 'calc(10px)',
						'z-index': 'var(--z)',
					},
				}),
			])
			expect(reported(scene)).toEqual([
				{
					feature: 'style.opacity var(--o)',
					fix: 'give it a number or a percentage, which a canvas can read',
				},
				{
					feature: 'style.z-index var(--z)',
					fix: 'give it a whole number, which a canvas can read',
				},
				{
					feature: 'style.translate 1em 2em',
					fix: 'give it lengths in px or %, which a canvas can read',
				},
				{
					feature: 'style.transform-origin calc(10px)',
					fix: 'give it lengths in px or % or keywords such as left and top, which a canvas can read',
				},
			])
		})

		it('none for translated style keys it can read', () => {
			const scene = paint([
				sprite('a', {
					style: {
						translate: 'none',
						opacity: '50%',
						'transform-origin': 'right 20%',
						'z-index': 'auto',
						visibility: 'visible',
						display: 'block',
						filter: 'none',
					},
				}),
				sprite('b', {
					style: {
						translate: '-5px',
						opacity: 1,
						'transform-origin': '0 0',
						'z-index': 3,
					},
				}),
			])
			expect(scene.canvasIssues()).toEqual([])
		})
	})

	describe('not for a Controller with a Draw Hook', () => {
		it('for its children or untranslatable style', () => {
			const scene = paint([
				sprite('a', {
					children: () => 'hello',
					style: {
						'clip-path': 'circle()',
						'border-radius': '50%',
						filter: 'blur(2px)',
					},
					draw: ({ drawDefault }) => drawDefault(),
				}),
			])
			expect(scene.canvasIssues()).toEqual([])
		})

		it('but still for its class, inner.style and where it is', () => {
			const scene = paint([
				sprite('a', {
					class: 'leafy',
					innerStyle: { 'background-size': 'contain' },
					// Its context is moved into a box without the matrix
					style: { transform: 'matrix(1, 0, 0, 1, 5, 5)' },
					draw: ({ drawDefault }) => drawDefault(),
				}),
			])
			expect(reported(scene).map((issue) => issue.feature)).toEqual([
				'class',
				'inner.style',
				'style.transform matrix()',
			])
		})
	})

	describe('for a Frame whose image fails to load', () => {
		const fix =
			"check the image is where the URL says, and what the Scene's resolveAsset gives for it"

		it('as image, with the URL in the record and on the console', () => {
			const scene = paint([
				sprite('a', { type: 'tree', frames: ['missing.png#0,0,10,10'] }),
			])
			images.fail('missing.png')
			expect(scene.canvasIssues()).toEqual([
				{
					feature: 'image',
					type: 'tree',
					id: 'a',
					url: 'missing.png',
					createdAt: expect.any(String),
					fix,
				},
			])
			expect(logged()[0].split('\n')).toEqual([
				'[scoopjs:canvas] unsupported image on type "tree" (id "a")',
				'  url: missing.png',
				expect.stringMatching(/^ {2}created at /),
				`  fix: ${fix}`,
			])
		})

		it('once for each Controller type, however many images fail', () => {
			const scene = paint([
				sprite('a', { type: 'tree', frames: ['oak.png', 'elm.png'] }),
				sprite('b', { type: 'tree', frames: ['elm.png'] }),
				sprite('c', { type: 'rock', frames: ['elm.png'] }),
			])
			images.fail('oak.png')
			images.fail('elm.png')
			vi.advanceTimersByTime(10)
			frames.run()
			expect(
				scene.canvasIssues().map(({ feature, type, url }) => ({
					feature,
					type,
					url,
				})),
			).toEqual([
				{ feature: 'image', type: 'tree', url: 'oak.png' },
				{ feature: 'image', type: 'rock', url: 'elm.png' },
			])
		})
	})

	describe("for the Scene's DOM-only options", () => {
		it('cameraLayer and standbyFrames, as soon as the Canvas Renderer is', () => {
			paint([], { cameraLayer: true, standbyFrames: true })
			expect(logged()).toEqual([
				[
					'[scoopjs:canvas] unsupported scene.cameraLayer on scene "test"',
					'  fix: it does nothing under the Canvas Renderer, so leave it off',
				].join('\n'),
				[
					'[scoopjs:canvas] unsupported scene.standbyFrames on scene "test"',
					'  fix: it does nothing under the Canvas Renderer, so leave it off',
				].join('\n'),
			])
		})

		it('as records without a Controller', () => {
			const scene = paint([], { cameraLayer: true })
			expect(scene.canvasIssues()).toEqual([
				{
					feature: 'scene.cameraLayer',
					fix: 'it does nothing under the Canvas Renderer, so leave it off',
				},
			])
		})

		it("not when they're off", () => {
			const scene = paint([], { cameraLayer: false })
			expect(scene.canvasIssues()).toEqual([])
		})
	})

	describe('for a read of $ref, with onMount still run', () => {
		it("giving undefined, since there's no element", () => {
			const refs: unknown[] = []
			const scene = paint([
				sprite('a', {
					type: 'lamp',
					onMount: ({ $ref }) => refs.push($ref),
				}),
			])
			expect(refs).toEqual([undefined])
			expect(scene.canvasIssues()).toEqual([
				expect.objectContaining({ feature: '$ref', type: 'lamp', id: 'a' }),
			])
		})

		it("not for an onMount that doesn't read it", () => {
			const mounted: string[] = []
			const scene = paint([
				sprite('a', { onMount: ({ $ }) => mounted.push($.id) }),
			])
			expect(mounted).toEqual(['a'])
			expect(scene.canvasIssues()).toEqual([])
		})

		it('once for each Controller, attached ones and ones added later too', () => {
			const mounted: string[] = []
			const onMount = ({ $ }: { $: ControllerBaseType }) => mounted.push($.id)
			const carrier = sprite('carrier', { onMount })
			carrier.attach(sprite('hat', { onMount }))
			const scene = paint([carrier])
			vi.advanceTimersByTime(30)
			frames.run()
			scene.addController(sprite('late', { onMount }))
			frames.run()
			expect(mounted).toEqual(['carrier', 'hat', 'late'])
		})

		it('for a part of a part too', () => {
			const mounted: string[] = []
			const onMount = ({ $ }: { $: ControllerBaseType }) => mounted.push($.id)
			const arm = sprite('arm', { onMount })
			arm.attach(sprite('hand', { onMount }))
			const carrier = sprite('carrier', { onMount })
			carrier.attach(arm)
			paint([carrier])
			expect(mounted).toEqual(['carrier', 'arm', 'hand'])
		})
	})
})
