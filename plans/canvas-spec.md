# Spec: Canvas Renderer

Status: ready-for-agent. The reasoning and build order are in [canvas.md](canvas.md). The decision this spec follows is [ADR 0002](../docs/adr/0002-canvas-renderer-translates-or-reports.md). Terms are as defined in [GLOSSARY.md](../GLOSSARY.md).

## Problem Statement

Every Sprite in a ScoopJS game is page elements styled by CSS, and the DOM Renderer is the only way to draw a Scene. In a busy Scene the browser spends its time recalculating styles, re-running filters and laying out hundreds of elements. freediver has measured some of this: filters rebuilt every Tick, about 600 style recalculations a second from light rays, and 80 plants rotating every Tick. run-game and freediver both feel it most on phones.

There's no way to try a different way of drawing without rewriting a game. So nobody knows whether painting onto a `<canvas>` would be meaningfully faster. Nobody knows either which parts of each game would stop working if it were.

## Solution

A second Renderer, the **Canvas Renderer**, that a game opts into by mounting it in place of the DOM Renderer. The Scene and its Controllers stay exactly as they are. The game's UI (underlay, overlay, dialogs, the Modal, the loading screen) stays page elements around the `<canvas>`.

- It paints every Sprite onto one `<canvas>`, in the same order the DOM Renderer draws them.
- It honours the parts of a Controller's `style` that a canvas can reproduce: opacity, hiding, stacking, transforms and colour filters.
- Anything it can't draw (children, classes, clip paths, transitions and the like) draws nothing. It's reported to the console as a **Canvas Issue**, with where the Controller was created and how to fix it. A developer or an agent can then work through the list.
- A Controller can take over its own painting with a **Draw Hook**.

Groundwork comes first and benefits every game under the DOM Renderer too:
- a Controller's Frames step inside the Controller rather than inside the DOM Sprite
- `hitTest` compares where Controllers are actually drawn
- a Scene can say which Controllers are under a point

Then the two Renderers are benchmarked against each other in run-game. The Canvas Renderer only goes further if it gives at least 2× better frame time on a phone.

## User Stories

### Choosing a Renderer

1. As a game developer, I want to switch my game to the Canvas Renderer by mounting a different component, so that I can try canvas without changing my Scene or Controllers.
2. As a game developer, I want the DOM Renderer to keep working exactly as it does now, so that opting into canvas is never forced on me.
3. As a game developer, I want the old `Canvas` component name to keep working for a while after it's renamed `DomRenderer`, so that upgrading ScoopJS doesn't break my game straight away.
4. As a game developer, I want my Scene not to know which Renderer draws it, so that I can switch back and forth while I compare them.
5. As a game developer, I want my underlay, overlay, dialog, under-dialog, Modal and loading screen to keep working under the Canvas Renderer as page elements, so that my menus, HUD and text don't need porting.
6. As a game developer, I want the Canvas Renderer's click, mouse-down and mouse-up handlers to give me the same scene coordinates as the DOM Renderer's, so that my input code doesn't change.
7. As a game developer, I want the Canvas Renderer to pause the Scene when it's scrolled off the screen, unless I've asked it to run off screen, so that it behaves like the DOM Renderer.
8. As a game developer, I want the Canvas Renderer to accept my class and style for its own element, so that I can size, place and transform it on the page as I do now.
9. As a player, I want the game to look the same under either Renderer, wherever the game uses features both support, so that switching isn't something I notice.

### Painting

10. As a player, I want the canvas to repaint every display frame that something changed, so that movement is smooth.
11. As a player on a phone, I want the canvas not to repaint when nothing has changed, so that a still screen doesn't drain my battery.
12. As a game developer, I want the canvas to repaint when a Tick runs, a Ticker runs, the camera moves, the Renderer resizes or an image finishes loading, so that nothing is ever left showing stale.
13. As a player on a high-density screen, I want the canvas drawn at my screen's pixel density, so that sprites are sharp rather than blurry.
14. As a pixel-art game developer, I want to turn image smoothing off for the whole Renderer, so that my art stays crisp when scaled, as `image-rendering: pixelated` does now.
15. As a game developer who zooms my scene with a CSS transform on the Renderer element, I want that to keep working, so that my camera zoom and screen shake don't need rewriting.
16. As a player, I want sprites outside the view not to cost anything to paint, so that a long course with hundreds of mounted Controllers stays fast.

### Draw order

17. As a game developer, I want Sprites painted in my `assetOrder`, so that my layers stack as they do now.
18. As a game developer, I want Controllers that aren't in `assetOrder` painted in the order I added them, so that I get the same order I get under the DOM Renderer.
19. As a game developer, I want each Attached Controller painted straight after the Controller carrying it, so that wheels, hats and arms sit over their carrier as they do now.
20. As a game developer, I want Attached Controllers painted in the order they were attached, so that a carrier's parts overlap as they do now.
21. As a game developer, I want `z-index` in a Controller's style to reorder it among the top-level Sprites, so that a lifted runner can pass over everything else.
22. As a game developer, I want `z-index` to reorder Attached Controllers among their carrier's parts, so that a storm cloud can sit behind its lightning bolts.

### Frames

23. As a game developer, I want my plain image Frames painted at the Sprite's size, so that ordinary sprites look the same.
24. As a game developer, I want my data-URL Frames (generated PNGs and SVGs) to paint, so that runtime-generated art keeps working.
25. As a game developer, I want my SVG file Frames to paint, so that vector assets keep working.
26. As a game developer with sprite sheets, I want `url#x,y,w,h` Frames cropped exactly as the DOM Renderer crops them: offsets in display pixels, the sheet scaled to the Sprite's height, offsets wrapping round the sheet. That way my existing sheet helpers still pick the right Frame.
27. As a game developer with sprite sheets that use negative offsets, I want those cropped correctly too, so that sheets with gutters work.
28. As a game developer with an Asset Resolver, I want the Canvas Renderer to paint the resolved image, so that seasonal art works under canvas.
29. As a game developer, I want to know that an animated SVG Frame only shows its first frame under canvas, so that I'm not surprised.
30. As a game developer, I want a Sprite with no Frames to paint nothing (unless it has a Draw Hook), so that invisible trigger boxes cost nothing.

### Frame stepping (groundwork)

31. As a game developer, I want `$currentFrame` to be exactly the Frame on screen in the same Tick, so that gameplay keyed to animation frames (an octopus speeding up on its stroke frames) is exact rather than a Tick behind.
32. As a game developer, I want my Controllers' Frames to step on the Scene's Tick by default, so that a Sprite changes Frame in the same update as it moves, as it does now.
33. As a game developer, I want the display-refresh frame clock to keep working, so that Frame intervals that aren't a whole number of Ticks still look right.
34. As a game developer, I want `frameInterval`, `randomStartFrame`, a controlled `frame` and play/pause `state` to behave as they do now, so that my animations don't change.
35. As a game developer, I want Attached Controllers' Frames stepped along with their carriers, so that a bus's wheels keep turning.
36. As a game developer, I want animation paused while a Modal is up or the Scene is loading, as now, so that a pause screen freezes the action.
37. As a ScoopJS maintainer, I want frame stepping testable without a page, so that animation bugs are caught by fast tests.
38. As a game developer, I want the exported Sprite component to keep animating when it's used without a Controller, so that the public API doesn't break.

### Drawn boxes, hit tests and Pointer Pick (groundwork)

39. As a game developer, I want `hitTest` to compare where two Controllers are drawn, so that collisions match what the player sees.
40. As a game developer, I want `hitTest` on an Attached Controller to use its position composed through its carrier, so that a hand three levels down an arm can grab a starfish.
41. As a game developer, I want `hitTest` to account for rotation, scale, flips and origin, so that a rotated arm's box is where the arm actually is.
42. As a game developer, I want `hitTest` to account for parallax and the camera, so that a shark in a parallax layer hits the diver where it appears.
43. As a game developer whose game wraps `hitTest` with DOM measurements, I want ScoopJS's own `hitTest` to give the same answers, so that I can delete my wrapper and use either Renderer.
44. As a game developer, I want `scene.controllersAt(point)` to give me the Controllers drawn under a point on the screen, topmost first, so that I can work out what a click landed on without my own maths.
45. As a game developer, I want `controllersAt` to give the same answer under either Renderer, so that my click handling doesn't depend on which one draws the Scene.

### Translated style

46. As a game developer, I want `style.opacity` honoured, including through Attached Controllers, so that blinking players and faded shadows work.
47. As a game developer, I want `visibility: hidden` and `display: none` honoured, so that Controllers I hide stay hidden, and `display: none` hides their attached parts too.
48. As a game developer, I want `style.transform` with `translate`, `scale`, `rotate` and `skew` honoured, applied after the engine's own scale and rotation as CSS does. That way squash, lift and skewed scenery draw the same.
49. As a game developer, I want the separate `translate` property and `transform-origin` honoured, so that jittering fish and pivoting branches draw the same.
50. As a game developer, I want `filter` with `hue-rotate`, `brightness`, `sepia` and `saturate` honoured, so that tinted zombies, damaged divers and recoloured scenery look the same.
51. As a game developer, I want `filter: drop-shadow(...)` honoured, so that glows and outlines still show.
52. As a player on an iPhone, I want colour filters to work even though WebKit's canvas doesn't support them natively, so that the game looks the same on my phone.
53. As a player on an iPhone, I want an animated filter not to stutter or exhaust memory, so that a pulsing glow stays smooth.
54. As a game developer, I want no new props I must learn to get opacity, hiding, stacking or filters under canvas, so that porting changes nothing it doesn't have to.

### Draw Hook

55. As a game developer, I want to give a Controller a `draw` function that paints its Sprite, so that I can draw clip paths, gradients, text and shapes the Canvas Renderer can't get from style.
56. As a game developer, I want my Draw Hook's context already moved into the Sprite's own box, with position, rotation, scale and opacity applied, so that I only draw from (0, 0) to (width, height).
57. As a game developer, I want a `drawDefault()` in my Draw Hook, so that I can paint the current Frame and then draw over or under it.
58. As a game developer, I want my Draw Hook given the Controller's data, its Scene and its current Frame, so that it can draw from game state.
59. As a game developer, I want Attached Controllers still painted after my Draw Hook, so that taking over a carrier's drawing doesn't lose its parts.
60. As a game developer, I want the DOM Renderer to ignore Draw Hooks, so that one Controller can keep its `children` for the DOM and use `draw` for canvas while I compare the two.
61. As a game developer, I want a Controller with a Draw Hook not reported for its `children` or untranslatable style, so that the console only lists what's still to port.

### Canvas Issues

62. As a game developer, I want anything the Canvas Renderer can't draw to be reported with `console.error`, so that nothing is broken silently.
63. As a game developer, I want each Canvas Issue reported once per Controller type and feature, never per instance or per Tick, so that the console stays readable.
64. As a game developer, I want each report to name the feature (`children`, `class`, `inner.style`, the exact `style` key, a read of `$ref`), the Controller type and an example id, so that I know what to fix.
65. As a game developer, I want each report to say where the Controller was created, as a file and line, so that I can jump straight to it.
66. As a game developer, I want each report to say how to fix it where there's a way, such as using a Draw Hook, so that I don't have to look it up.
67. As an agent porting a game, I want every report to start with the same fixed prefix, so that I can find them all in console output.
68. As an agent porting a game, I want `scene.canvasIssues()` to return every Canvas Issue so far as JSON, so that one call gives me the whole list to work through.
69. As a game developer, I want a `filter` function outside the supported set reported, rather than quietly dropped, so that I notice the tint is gone.
70. As a game developer, I want `onMount` reported only if it actually reads `$ref`, so that Controllers that use `onMount` for other things aren't flagged.
71. As a game developer, I want DOM-only Scene options (`cameraLayer`, `standbyFrames`) reported when I use the Canvas Renderer, so that I know they do nothing there.
72. As a game developer, I want issues reported the first time they're drawn, so that a style that only appears mid-level is still caught when I get there.
73. As a player, I want no outlines or markers painted over the game for unsupported features, so that a game with Canvas Issues left still looks like a game.

### Benchmark

74. As a ScoopJS maintainer, I want a stress page in this repo that runs N moving, animated, rotated sprites under either Renderer, from 100 to 5,000, so that I can compare raw drawing cost.
75. As a ScoopJS maintainer, I want a bench switch that skips `children` in both Renderers, so that I can compare run-game fairly before porting its art.
76. As a ScoopJS maintainer, I want to profile run-game on my phone under each Renderer during a busy race, so that I measure the case that matters.
77. As a ScoopJS maintainer, I want one busy run-game course ported to Frames and Draw Hooks and measured again, so that I know whether canvas wins with real art.
78. As a ScoopJS maintainer, I want a clear bar (2× better frame time on the phone), so that the decision to carry on or stop isn't a matter of taste.
79. As a ScoopJS maintainer, I want the groundwork to stand on its own if canvas misses the bar, so that the experiment isn't wasted.

## Implementation Decisions

### Modules

- **Controller.** Gains frame stepping: its current Frame and how it advances, from `frameInterval`, `randomStartFrame`, a controlled `frame` and play/pause `state`.
  - `$currentFrame` reads this value directly. The callback the DOM Sprite used to report its Frame back with goes away.
  - Gains an optional `draw` option, the Draw Hook.
  - Records a stack at creation, used only to say where it was created in Canvas Issues.
- **Scene.**
  - Steps every Controller's Frames once per Tick on the `'tick'` frame clock, and on its own `requestAnimationFrame` loop on the `'display'` clock. Carriers step their Attached Controllers.
  - Gains `controllersAt(point)` and `canvasIssues()`.
  - Still knows nothing about which Renderer draws it.
- **Drawn-box geometry.** A new, deep module behind a small interface. Given a Controller and the Scene's camera, it returns the axis-aligned box where the Controller is drawn. It composes position, size, scale, flips, rotation, origin and the extra `transform` from style through every carrier, then applies parallax.
  - `hitTest`, `controllersAt` and the Canvas Renderer's off-screen check all use it.
  - It's also where the Canvas Renderer gets each Sprite's transform, so painting and hit testing agree.
- **DOM Renderer.** Today's `Canvas` component, renamed. `Canvas` stays as a deprecated alias for the rest of 0.x.
  - The DOM Sprite now reads its Frame from the Controller instead of stepping it itself.
  - The exported Sprite keeps a fallback stepper for use without a Controller.
- **Canvas Renderer.** A new component in Core, exported next to the DOM Renderer, with the same props: scene, the UI layers, class, style, run-off-screen and the pointer handlers.
  - Adds a `pixelated` prop.
  - Is made of a scheduler (repaint on `requestAnimationFrame` when changed), a draw-order builder, a Frame painter (image loading, sheet cropping), a style translator, a filter applier, and an issue reporter.
- **Style translator.** A deep module. It turns a Controller's `style` into canvas state:
  - alpha
  - hidden or not, and whether that hides attached parts
  - a stacking order
  - an extra transform
  - a filter description
  - a list of untranslatable keys

  It works on the same style objects games already pass, and never parses anything outside the supported list.
- **Filter applier.** Uses the context's `filter` when the browser supports it, detected once. Otherwise it recolours each Frame once per rounded filter value and caches the result. Values are rounded to a whole degree for hue and to 0.01 for the others. `drop-shadow` always goes through the context's shadow settings.
- **Issue reporter.** Keeps the Canvas Issues for a Scene. It logs one `console.error` per Controller type and feature, the first time that feature is drawn, and serves them back through `canvasIssues()`.

### Contracts

- **Draw order:**
  1. `assetOrder`
  2. then the order Controllers were added
  3. Attached Controllers straight after their carrier, inside its transform, in the order they were attached
  4. `z-index` sorts within each of those levels
- **Frame cropping.** The same results as the DOM Renderer's CSS backgrounds:
  - With a crop, the image is scaled so its height is the Sprite's height, the offset is in display pixels, and offsets wrap modulo the scaled sheet's width and height.
  - Without one, the image is stretched to the Sprite's box.
- **Translated style keys:**
  - `opacity`
  - `visibility`
  - `display: none`
  - `z-index`
  - `transform` (`translate`, `scale`, `rotate`, `skew`)
  - `translate`
  - `transform-origin`
  - `filter` (`hue-rotate`, `brightness`, `sepia`, `saturate`, `drop-shadow`)

  Every other key is a Canvas Issue.
- **A Canvas Issue** carries:
  - the feature (e.g. `children`, `class`, `inner.style`, `style.clip-path`, `$ref`, `scene.cameraLayer`)
  - the Controller type
  - one example id
  - where the Controller was created
  - a fix hint where there is one

  The console line starts with `[scoopjs:canvas]`. `canvasIssues()` returns the same records.
- **The Draw Hook** is called with:
  - the 2D context, already transformed into the Sprite's box and with alpha, filter and shadow applied
  - `drawDefault()`, which paints the current Frame into that box
  - the Controller's data, its Scene and its current Frame

  With a Draw Hook present, `children` and untranslatable style keys on that Controller aren't reported.

  This type shape encodes the decision:

  ```ts
  draw?: (data: {
  	ctx: CanvasRenderingContext2D
  	drawDefault: () => void
  	$: T
  	$scene: Scene
  	$currentFrame: number
  }) => void
  ```
- **`$ref`.** Under the Canvas Renderer, `onMount` still runs. Its `$ref` is a getter that returns `undefined` and records a Canvas Issue when read.
- **Repainting.** A full repaint, at most once per display frame, only when something changed since the last one: a Tick, a Ticker, the camera, a resize or an image load. Sprites whose drawn box is outside the view are skipped.
- **The backing store** is the Renderer's width and height times `devicePixelRatio`, and is resized with the Renderer.

### Build order

1. Frame stepping into the Controller (ships alone).
2. Drawn-box geometry, `hitTest` on drawn boxes and `controllersAt` (ships alone).
3. Rename to `DomRenderer`, with the alias.
4. The Canvas Renderer.
5. The benchmark: stress page, run-game with `children` skipped in both, then one ported course.

## Testing Decisions

- **A good test** drives the engine through its public API and asserts on what a game or player would observe: Controller state after Ticks, which Controllers a point hits, what was painted and in what order, and what was reported. It never asserts on private helpers, internal signal layout or how the scheduler is built.
- **Seam 1, the Scene (existing).** Build a Scene with Controllers, advance fake timers, and assert on Controller state. This follows the existing Scene and collision tests in Vitest with jsdom and Solid's browser build. It covers:
  - frame stepping, including intervals that aren't whole Ticks, `randomStartFrame`, a controlled `frame`, play/pause, pausing under a Modal or while loading, Attached Controllers, and both frame clocks
  - `hitTest` on drawn boxes, with attached parts, nested rotation, flips, origin, style transforms, parallax and camera
  - `controllersAt`, including topmost first
- **Seam 2, the mounted Canvas Renderer (new, at the public component).** Mount the Canvas Renderer in jsdom against a Scene, with the canvas `getContext` stubbed in test setup to return a context that records every call and property set. Assert on what was painted:
  - which images, crops and destinations
  - transforms, alpha, filters and shadows
  - draw order, including Attached Controllers and `z-index`
  - Draw Hooks and `drawDefault()`
  - skipping off-screen Sprites
  - repainting only after a change
  - Canvas Issues, through `canvasIssues()` and a spy on `console.error`
  - the WebKit fallback, by making the stub report no `filter` support
- **A deliberate change of rule.** The original plan ruled out rendering tests. That was for the DOM. A canvas's paint calls are plain data, so they're worth asserting on.
- **The DOM Renderer gets no new tests.** With frame stepping in the Controller there's little left in it to test.
- **The benchmark is manual**, profiled on a phone. It isn't part of CI.

## Out of Scope

- Emulating the DOM under canvas: a page-element layer for `children`, or rasterising `children` through SVG `foreignObject`.
- Choosing the Renderer per Controller or with a Scene option.
- New typed Sprite props for opacity, visibility, stacking or filters.
- Visual markers for unsupported features.
- A per-Controller click API. `controllersAt` is all of Pointer Pick for now.
- Drawing only the areas that changed, WebGL, and OffscreenCanvas in a worker.
- A renderer interface or plugin hook for Renderers.
- Porting the rest of run-game, the header or freediver. That's only one busy run-game course, for the benchmark.
- Moving `cameraLayer` and `standbyFrames` onto the DOM Renderer. They're reported under canvas for now and move later.
- CSS `transition` and `animation` under canvas. Games tween over Ticks instead.

## Further Notes

- A survey of the three games on 13 November 2026 shapes these decisions. Details are in [canvas.md](canvas.md).
- **The real answer comes late.** run-game draws most of its art through `children`, so only the ported course in the benchmark shows whether canvas is worth it.
- **WebKit filter support.** Canvas `filter` isn't Baseline, and no stable Safari release was found to ship it. Every iPhone browser is WebKit, so the fallback has to be solid.
- **Transform order matters.** Translated style transforms must compose in the same order CSS applies them (the engine's scale and rotation, then the style transform, around the origin). Otherwise squashed and skewed sprites will be slightly wrong, and drawn boxes will disagree with what's painted.
- Canvas Issues are only found by drawing, so finding them all in a game means playing through its levels.
