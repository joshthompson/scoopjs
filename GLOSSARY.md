# ScoopJS

A game engine where SolidJS components are the game objects: a scene ticks its controllers, and each one is drawn as a sprite that follows its signals. It knows nothing about any one game.

## Language

### Engine

**Scene**:
One running game world: its controllers, its tick and the camera onto it.
_Avoid_: Game, world, stage, level

**Tick**:
One step of a Scene, in which each Controller moves and then every Ticker runs. A Scene only ticks while it's on the screen.
_Avoid_: Frame (that's a Sprite's image), update, step

**Controller**:
One thing in a Scene: its data, as signals, and what it does each Tick.
_Avoid_: Entity, actor, game object, node

**Attached Controller**:
A Controller carried by another one, moving and drawn with it, such as a hat on a runner.
_Avoid_: Child, component

**Sprite**:
How a Controller looks: its Frames, size, position and anything drawn inside it.
_Avoid_: Image, view

**Frame**:
One image a Sprite can show, or one part of a sprite sheet. A Sprite steps through its Frames to animate.
_Avoid_: Tick (a Frame is a picture, not a moment)

**Ticker**:
Something run at the end of every Tick whether the Scene is paused or not, such as a Sprite stepping through its Frames.

**Renderer**:
What draws a Scene on the page. A Scene doesn't know which one draws it, and a game picks one by which it puts on the page.
_Avoid_: Canvas (that's the `<canvas>` element), screen, viewport

**DOM Renderer**:
The Renderer that draws each Sprite as page elements of its own, styled by CSS.

**Canvas Renderer**:
The Renderer that paints every Sprite onto one `<canvas>`, with the game's UI still page elements over and under it.

**Draw Hook**:
A Controller's own way of painting its Sprite under the Canvas Renderer, for effects the Canvas Renderer can't draw from its style.
_Avoid_: Render function, render callback, filter

**Canvas Issue**:
Something a Controller asks for that the Canvas Renderer can't draw, such as children or a clip path, reported rather than drawn.
_Avoid_: Incompatibility, warning

**Pointer Pick**:
Finding which Controllers a point on the screen lands on, by where they're drawn, topmost first.
_Avoid_: Hit test (that's two Controllers overlapping)

**Modal**:
Whatever's shown over a Scene, which pauses its Controllers while it's up.
_Avoid_: Dialog (a game's own), popup

**Solid** (of a Controller):
That other Controllers can't move through it. Nothing to do with SolidJS.
_Avoid_: Collider, wall

**Asset Resolver**:
What a game gives a Scene to swap an image for the one to actually show, such as a seasonal version of it.

### Packages

**Core**:
The engine's main package (`@joshthompson/scoopjs` for now, installed as `scoopjs`): Scene, Controller, Sprite, the Renderers and collision. A game can't do without it.

**Plugin**:
A package of its own that a game can choose to use, built only on Core's public API, never registered with it.
_Avoid_: Extension, addon, module
