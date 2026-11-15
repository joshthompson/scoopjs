# Versions

ScoopJS is pre-1.0: any minor version can break the API. This page sums up
what each release brought and what to change when you upgrade. Every
change, in full, is in the [Changelog](/changelog).

## 0.3.0

Released 15 November 2026. **The Canvas Renderer.**

- **`CanvasRenderer`**, a second Renderer, paints every Sprite onto one
  `<canvas>`. A game tries it by mounting it in place of the DOM Renderer,
  with the same props. It draws Frames and sprite sheets, the parts of
  `style` a canvas can reproduce, at the screen's own pixel density, and
  repaints only when something changed. Its `pixelated` prop is for pixel
  art. See [Canvas Renderer](/renderers/canvas-renderer).
- **Draw Hooks**: a Controller's `draw` option paints its Sprite under the
  Canvas Renderer, with `drawDefault()`, `image(url)` and `drawReach`. See
  [Draw Hooks](/renderers/draw-hooks).
- **Canvas Issues**: whatever the Canvas Renderer can't draw is logged once
  per Controller type and feature, with where it was made and how to fix
  it, and listed by `scene.canvasIssues()`. See [Canvas
  Issues](/renderers/canvas-issues).
- **`Canvas` is renamed `DomRenderer`**, and `CanvasProps` is
  `DomRendererProps`. The old names still work, deprecated, until 1.0.
- **Frames step in the Controller**, not the DOM Sprite. `$currentFrame` is
  now exactly the Frame on screen, not a Tick behind, and
  `controller.currentFrame()` reads it.
- **`hitTest` compares where Controllers are drawn**: through carriers,
  rotation, scale, flips, `origin`, a style's transforms and parallax. It
  used to compare raw `x`, `y`, `width` and `height`.
- **New**: `scene.controllersAt(point)` (the Pointer Pick),
  `controller.carrier()`, the `AnyController` type, and the `skipChildren`
  Scene option for benchmarking.
- **Fixes**: the lookups find Attached Controllers however deep; pointer
  handlers give the right coordinates when the Renderer is scaled with CSS;
  a Sprite jumps to a `frame` again when it's set after being left unset.

### Upgrading from 0.2

- Rename `Canvas` to `DomRenderer` and `CanvasProps` to `DomRendererProps`
  (optional until 1.0).
- If a game corrected `hitTest` for Attached Controllers, parallax or
  rotation itself, that correction can go: `hitTest` does it now.
- A game that read `$currentFrame` expecting it a Tick behind now gets the
  Frame on screen.

## 0.2.0

Released 12 November 2026. **What freediver, a second game, needed.** All
off by default, so a game that doesn't ask for them draws as before:

- `cameraLayer`: the camera moves one layer, not every Sprite.
- `standbyFrames`: a Sprite keeps every image it switches between painted,
  so switching doesn't flash blank.
- `frameClock: 'display'`: Frames step on the screen's refresh, timed to the
  millisecond.
- The Renderer's `underDialog`: drawn over the Sprites, under the `dialog`.
- `createConnectedController` takes `onMount`.

Also: the camera's `y` moves Sprites (it was ignored); `blockedBySolid`
leaves a move with nothing in its way alone; `getControllerById` is a
lookup rather than a search; `addController` adds several Controllers at
once.

## 0.1.0

Released 12 November 2026. **The first release.** The engine behind the
Scoop Bus Run Club games, taken out of the website into a package of its
own, with nothing of those games left in it: `Scene`, `createController` and
`createConnectedController`, `Sprite`, the DOM Renderer (then called
`Canvas`), the Modal, collision, `Key` and `createObjectSignal`.

Changesets started writing the changelog after it, so it has no entry
there.

## Deprecations

| Deprecated | Use | Goes in |
|---|---|---|
| `Canvas` (the component) | `DomRenderer` | 1.0 |
| `CanvasProps` | `DomRendererProps` | 1.0 |

The `Canvas` type, the value of `scene.canvas`, isn't deprecated: it keeps
its name.

## How releases work

- **Changesets.** A change worth releasing comes with a changeset: run
  `pnpm changeset`, say whether it's a patch or a minor change, describe it,
  and commit the file it writes. Before 1.0, anything that breaks the API is
  a minor change.
- **The Version Packages PR.** On `main`, the release workflow keeps a pull
  request open, named "Version Packages", that bumps the version and writes
  the changelog from the changesets waiting.
- **Publishing.** Merging that PR publishes the new version to GitHub
  Packages, as `@joshthompson/scoopjs`, with the repo's own token. Nothing
  goes out that CI wouldn't pass: the workflow lints, type-checks and tests
  first.
- **Where it's going.** It's on GitHub Packages until its npm name is
  settled. Games install it under the alias `scoopjs`, so moving registry
  changes one line in each game's `package.json`, not every import.

The version in this site's header is read from the package's
`package.json` as the site is built, so it's the version on `main`, which is
the latest release.
