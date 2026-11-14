// The stress page: N moving, animated, rotated Sprites under whichever
// Renderer is picked, with the frame time shown above them. Plain JavaScript
// against Core as built, so it needs no JSX and nothing to compile it.
import { CanvasRenderer, DomRenderer, Scene, createController } from 'scoopjs'
import { createSignal } from 'solid-js'
import { createComponent, render } from 'solid-js/web'

const WIDTH = 800
const HEIGHT = 600
const SIZE = 32
const FRAMES = 4
/** A tick a display frame, so every frame the browser shows has work in it. */
const TICK = 16

const controls = document.getElementById('controls')
const stats = document.getElementById('stats')
const stage = document.getElementById('stage')

/** The settings in the page's address, so a reload keeps them. */
function readSettings() {
	const query = new URLSearchParams(location.search)
	return {
		count: Number(query.get('count') ?? 500),
		renderer: query.get('renderer') === 'canvas' ? 'canvas' : 'dom',
		skipChildren: query.get('skipChildren') === '1',
	}
}

function showSettings(settings) {
	controls.elements.count.value = String(settings.count)
	controls.elements.renderer.value = settings.renderer
	controls.elements.skipChildren.checked = settings.skipChildren
}

function writeSettings() {
	const query = new URLSearchParams({
		count: controls.elements.count.value,
		renderer: controls.elements.renderer.value,
		skipChildren: controls.elements.skipChildren.checked ? '1' : '0',
	})
	history.replaceState(null, '', `?${query}`)
}

/**
 * A sprite sheet of four Frames side by side, each a square with a bar
 * turned a little further, as a blob URL. Made here, so the page has no
 * image files of its own, and short, so the DOM Renderer's styles aren't
 * thousands of characters each.
 */
async function makeSheet() {
	const canvas = document.createElement('canvas')
	canvas.width = SIZE * FRAMES
	canvas.height = SIZE
	const ctx = canvas.getContext('2d')
	for (let i = 0; i < FRAMES; i++) {
		ctx.save()
		ctx.translate(i * SIZE + SIZE / 2, SIZE / 2)
		ctx.fillStyle = `hsl(${i * 90}, 70%, 50%)`
		ctx.fillRect(-SIZE / 2 + 2, -SIZE / 2 + 2, SIZE - 4, SIZE - 4)
		ctx.rotate((i * Math.PI) / FRAMES)
		ctx.fillStyle = 'white'
		ctx.fillRect(-SIZE / 2 + 6, -3, SIZE - 12, 6)
		ctx.restore()
	}
	const blob = await new Promise((resolve) => canvas.toBlob(resolve))
	return URL.createObjectURL(blob)
}

/** One Sprite drifting and spinning about the Scene, bouncing off its edges. */
function mover(index, sheet) {
	return createController({
		frames: Array.from(
			{ length: FRAMES },
			(_, i) => `${sheet}#${-i * SIZE},0,${SIZE},${SIZE}`,
		),
		randomStartFrame: true,
		init: () => {
			const [x, setX] = createSignal(Math.random() * (WIDTH - SIZE))
			const [y, setY] = createSignal(Math.random() * (HEIGHT - SIZE))
			const [rotation, setRotation] = createSignal(Math.random() * 360)
			return {
				id: `mover-${index}`,
				type: 'mover',
				x,
				y,
				setX,
				setY,
				rotation,
				setRotation,
				vx: (Math.random() - 0.5) * 6,
				vy: (Math.random() - 0.5) * 6,
				spin: (Math.random() - 0.5) * 10,
				width: () => SIZE,
				height: () => SIZE,
				state: () => 'play',
				frameInterval: () => 120,
				// Something drawn inside, as most of run-game's art is: the DOM
				// Renderer draws it unless `skipChildren` is on, and the Canvas
				// Renderer never does.
				children: () => {
					const label = document.createElement('span')
					label.textContent = String(index)
					label.style.cssText =
						'position:absolute;left:2px;top:2px;font:9px sans-serif;color:black'
					return label
				},
			}
		},
		onEnterFrame: ({ $ }) => {
			let x = $.x() + $.vx
			let y = $.y() + $.vy
			if (x < 0 || x > WIDTH - SIZE) {
				$.vx = -$.vx
				x = Math.min(Math.max(x, 0), WIDTH - SIZE)
			}
			if (y < 0 || y > HEIGHT - SIZE) {
				$.vy = -$.vy
				y = Math.min(Math.max(y, 0), HEIGHT - SIZE)
			}
			$.setX(x)
			$.setY(y)
			$.setRotation($.rotation() + $.spin)
		},
	})
}

/**
 * Times every display frame, and shows how long they took over the last
 * second: the mean, the slowest 5% and the slowest of all.
 */
function startTiming(describe) {
	let times = []
	let last = performance.now()
	let shown = last
	let request = requestAnimationFrame(function frame(now) {
		times.push(now - last)
		last = now
		if (now - shown >= 1000) {
			const sorted = [...times].sort((a, b) => a - b)
			const mean = times.reduce((sum, t) => sum + t, 0) / times.length
			const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
			const worst = sorted[sorted.length - 1] ?? 0
			stats.textContent = `${describe()}: ${(1000 / mean).toFixed(0)} fps, frame ${mean.toFixed(1)} ms mean, ${p95.toFixed(1)} ms p95, ${worst.toFixed(1)} ms worst`
			times = []
			shown = now
		}
		request = requestAnimationFrame(frame)
	})
	return () => cancelAnimationFrame(request)
}

const sheet = await makeSheet()
let stop = () => {}

/** Puts a fresh Scene on the page under the Renderer picked. */
function start() {
	stop()
	const settings = readSettings()
	const scene = new Scene('stress', {
		width: WIDTH,
		height: HEIGHT,
		frameRate: TICK,
		skipChildren: settings.skipChildren,
		setup: (s) =>
			s.addController(
				...Array.from({ length: settings.count }, (_, i) => mover(i, sheet)),
			),
	})
	const Renderer = settings.renderer === 'canvas' ? CanvasRenderer : DomRenderer
	// Unmounting the Renderer destroys the Scene with it
	const unmount = render(() => createComponent(Renderer, { scene }), stage)
	const stopTiming = startTiming(
		() =>
			`${settings.count} Sprites, ${settings.renderer === 'canvas' ? 'Canvas' : 'DOM'} Renderer${settings.skipChildren ? ', skipChildren' : ''}`,
	)
	stats.textContent = 'Measuring…'
	stop = () => {
		stopTiming()
		unmount()
	}
}

controls.addEventListener('change', () => {
	writeSettings()
	start()
})
showSettings(readSettings())
start()
