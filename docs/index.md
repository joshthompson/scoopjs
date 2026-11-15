---
layout: home

hero:
  name: ScoopJS
  text: A game engine where SolidJS components are the game objects
  tagline: A Scene ticks its Controllers, and each one is drawn as a Sprite that follows its own signals. There's no draw loop of its own; Solid's reactivity does the drawing.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Choose a Renderer
      link: /renderers/
    - theme: alt
      text: API
      link: /api

features:
  - title: Signals in, Sprites out
    details: A Controller is its data, as Solid signals, and what it does each Tick. Its Sprite reads those signals, so only what changed is drawn again.
  - title: Two Renderers, one Scene
    details: The DOM Renderer draws each Sprite as page elements. The Canvas Renderer paints them all onto one canvas. A game switches by mounting the other; the Scene doesn't change.
  - title: Collisions that match the screen
    details: hitTest and the Pointer Pick go by where Controllers are drawn, through carriers, rotation, flips and parallax, never by reading the page. They give the same answers under either Renderer.
  - title: Told what can't be drawn
    details: Whatever the Canvas Renderer can't draw is reported once as a Canvas Issue, with where the Controller was made and how to fix it, so porting a game is a list to work through.
---

## What it is

ScoopJS is a small game engine for [SolidJS](https://www.solidjs.com). It
came out of the [Scoop Bus Run Club](https://scoopbus.run) games, and it
knows nothing about any one game.

- A **Scene** is one running game world. It ticks every few milliseconds
  while it's on the screen.
- A **Controller** is one thing in it: a runner, a coin, a cloud. Its data is
  signals, and its `onEnterFrame` moves it each Tick.
- A **Sprite** is how a Controller looks: its Frames (images), size,
  position, rotation and style.
- A **Renderer** puts the Scene on the page. Pick the
  [DOM Renderer](/renderers/dom-renderer) or the
  [Canvas Renderer](/renderers/canvas-renderer).

It's pre-1.0, so any minor version can break the API. The
[Versions](/versions) page says what changed in each.

## Install

ScoopJS is on GitHub Packages for now, as `@joshthompson/scoopjs`. Install it
under the name `scoopjs`, so your imports stay the same when it moves to npm.

Tell your package manager where the `@joshthompson` scope lives:

```ini
# .npmrc, next to your package.json
@joshthompson:registry=https://npm.pkg.github.com
```

GitHub Packages wants a token even to install a public package. Make a
GitHub token with `read:packages`, and put it in your own `~/.npmrc`, not the
project's:

```ini
# ~/.npmrc
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

Then add it, with Solid:

```sh
pnpm add scoopjs@npm:@joshthompson/scoopjs solid-js
```

[Getting started](/getting-started) builds a first game from there, and
covers installing in CI.
