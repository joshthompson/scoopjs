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

**Canvas**:
What draws a Scene on the page. Today it's DOM elements, not a `<canvas>`.
_Avoid_: Screen, viewport

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
The `scoopjs` package: Scene, Controller, Sprite, Canvas and collision. A game can't do without it.

**Plugin**:
An `@scoopjs/*` package that a game can choose to use, built only on Core's public API, never registered with it.
_Avoid_: Extension, addon, module
