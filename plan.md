# ScoopJS plan

The plan for moving the Scoop Bus Run Club game engine into this repo and
publishing it as the `scoopjs` npm package. This file records what was decided
and why, what has been done, and what's left.

Decided on 11 November 2026. The decision is recorded in the monorepo as
`docs/adr/0004-engine-is-the-scoopjs-package.md`.

## Status

- [x] Repo set up at `~/Projects/scoopjs`: workspace, core package, tests,
      CI and release workflows, docs
- [x] Core extracted from `scoopbusrunclub/apps/web/src/engine` (at
      `12469dd`), with no Scoop Bus code left in it
- [x] run-game and the website header switched to `scoopjs`, through a
      local `link:` for now; `apps/web/src/engine` deleted
- [ ] First commit, then the public GitHub repo (`joshthompson/scoopjs`)
- [ ] `scoopjs` npm org created, and `scoopjs@0.1.0` published by hand
- [ ] Trusted publisher attached on npm; first release through the Action
- [ ] scoopbusrunclub switched from `link:` to `"scoopjs": "^0.1.0"`, then
      committed

Until that last step, **scoopbusrunclub can't deploy**: CI can't follow a
`link:` to a folder on this laptop. See [Bootstrap](#bootstrap) for the order.

## What ScoopJS is

A game engine for SolidJS where Solid components are the game objects. A
`Scene` ticks its `Controller`s, and each one is drawn as a `Sprite`, a DOM
element whose styles follow its signals. Solid's reactivity does the
rendering, and that is what sets ScoopJS apart from canvas engines, so Solid is
a peer dependency rather than an implementation detail.

Its first user is **run-game** (Scoop Bus Run, at scoopbus.run/run). The
website's **header** is the second. Both were already on the engine this was
extracted from.

Who it's for: mostly Josh, for this game and the next. It's also a hard line
that keeps game code out of the engine. It might become proper open source
later, but nothing promises that now: it's 0.x, and any minor version can break
the API.

## Rules

1. **ScoopJS doesn't know about Scoop Bus.** No Course, Scoop Bus, Pacer,
   Runner, parkrun, Room or any other word from the Scoop Bus glossary. If a
   game's word turns up in this repo, the boundary has leaked. Anything a game
   needs to change (seasonal images, say) is passed in as an option.
2. **Game code never touches the DOM through ScoopJS.** Games talk to
   Controllers and Sprite props, and ScoopJS itself never measures the page to
   decide what happens in the game (`hitTest` compares rects, not elements).
   That keeps a canvas renderer possible later as a swap, not a rewrite. It's a
   rule, not an abstraction: there's deliberately no renderer interface yet.
3. **Plugins are composition.** An optional extra is its own `@scoopjs/*`
   package, built only on Core's public API. Core has no plugin registry. See
   [docs/adr/0001](docs/adr/0001-plugins-are-composition.md).
4. **One Solid.** Core and every plugin list `solid-js` (and plugins list
   `scoopjs`) as peer dependencies.

## Decisions

Each line is the choice made, then the alternatives turned down.

| Question | Decision | Rejected |
|---|---|---|
| Starting point | `apps/web/src/engine` as run-game uses it, cut loose from the website | Adding run-game's generic pieces now; a fresh design |
| Renderer | DOM sprites now. Canvas maybe later, kept possible by rule 2 | Designing a renderer interface up front |
| Where it lives | Its own repo from day one | Incubating in the monorepo as `libs/scoopjs`; a git submodule |
| Git history | Fresh, starting from "extracted from scoopbusrunclub@12469dd" | `git filter-repo` of the engine's history, mostly header commits |
| Which fork | The monorepo's. Freediver's fork is ignored for now | Merging freediver's first |
| Other consumers | run-game first; the header switched too, since it needed nothing more than the leak fixes | Leaving the header on a copy, which would have made a third fork |
| Package names | `scoopjs` for Core, `@scoopjs/<name>` for plugins (the `vite` + `@vitejs/*` pattern) | Everything scoped (`@scoopjs/core`) |
| Package format | Compiled ESM, plus a `solid` export condition carrying the JSX, built by `tsup-preset-solid`; `solid-js` as a peer dependency | Shipping only compiled output |
| Versions | Changesets, every package on one version number during 0.x | Independent versions |
| Publishing | GitHub Action (`changesets/action`), with npm trusted publishing and provenance | Publishing by hand; an `NPM_TOKEN` secret |
| Tests | Vitest on the parts that run without a page: collision, the Scene tick, `hitTest` | DOM and rendering tests |
| Tooling | pnpm workspace, TypeScript strict, the monorepo's biome config | None |
| `Canvas` name | Kept for 0.1, though it's a `<div>`. Rename it when a canvas renderer arrives | Renaming now |

## What's in Core (0.1)

From `apps/web/src/engine`: `Scene`, `createController`,
`createConnectedController`, `Canvas`, `Sprite`, `ControllerSprite`, `Modal`
(internal), `Key` and `createObjectSignal`.

From the website's `utils/`: `isOverlapping` and the `SolidRect` types (from
`game.ts`), `blockBySolids` and `blockBySolidsRectPlayer`, and `SceneContext`.
`Vector` and `Rect`, which the website declares globally, are exported types.

### How it differs from the engine it came from

Changes needed to cut it loose:
- **`seasonalAsset` is now `SceneOptions.resolveAsset`.** The header passes
  `seasonalAsset`. run-game passes nothing, so its old `src/shims/seasons.ts`
  is gone.
- **Panda is replaced with inline styles.** The canvas background is `white`
  by default (it was `var(--color-white)`, which was `#fff` in both apps), and
  `style` overrides it as before.
- **The modal backdrop** is `var(--scoopjs-modal-backdrop, rgba(0, 0, 0, 0.5))`,
  on an element marked `data-scoopjs-modal`. run-game used to override a
  generated Panda class; it now sets the variable on its scene.
- **`hitTest`** compares the two controllers' own `x`/`y`/`width`/`height` (rule
  2). It used to `document.querySelector` both and compare their bounding
  rects. Neither app uses it.
- **`isOverlapping`** takes `Rect`s, not elements or `DOMRect`s.
- `Canvas` lost its unused type parameter, and now applies its `class` prop,
  which it used to ignore.
- `GameOptions` is exported, as `SceneOptions`. `ControllerProps` is exported too.

Bugs fixed on the way, none of which either app relied on:
- `blockBySolidsRectPlayer` never stopped a head-on move: it only set a
  position when there was sliding left to do. Its tests found this.
- `getSolidControllerRects` added `true` (as `1`) to a `solid: true`
  controller's position, and passed its `width` accessor as a number.
- `Canvas` passed key presses to its mouse handler, which threw on a key
  bubbling up from a focused link inside it. Since the canvas can't be focused
  itself, it now has no key handler.
- `Key.destroy()` added its listeners again instead of removing them.
- `loadingAssetTotal` was never set.
- A sprite without a height logged its controller's type to the console.

## Repo layout

```
scoopjs/
├── packages/
│   └── core/               # `scoopjs`
│       ├── src/            # index.tsx is the entry (.tsx so the preset emits the `solid` condition)
│       ├── test/           # Vitest, jsdom, Solid's browser build
│       └── tsup.config.ts
├── .changeset/             # one version for every package
├── .github/workflows/
│   ├── ci.yml              # lint, typecheck, test, build, on PRs and main
│   └── release.yml         # Version Packages PR, and publishing
├── docs/adr/
├── GLOSSARY.md
└── plan.md
```

Plugins go next to `core` as `packages/<name>`, published as
`@scoopjs/<name>`. Once there are two or more packages, list them all in one
group under `fixed` in `.changeset/config.json`. It's empty for now because a
group of one does nothing.

## Bootstrap

Steps only Josh can do (accounts, 2FA, the first publish), in order:

1. **Commit** in `~/Projects/scoopjs`: "Extracted from
   scoopbusrunclub@12469dd".
2. **Create the GitHub repo and push**:
   `gh repo create joshthompson/scoopjs --public --source ~/Projects/scoopjs --push`
3. **Create the npm org `scoopjs`** at <https://www.npmjs.com/org/create>
   (free, public packages). It holds the `@scoopjs/*` scope for plugins. The
   name was free on 11 November 2026, as was `scoopjs`.
4. **Publish 0.1.0 by hand.** npm can only attach a trusted publisher to a
   package that already exists:
   ```sh
   cd ~/Projects/scoopjs/packages/core
   pnpm build && npm publish --access public
   ```
5. **Attach the trusted publisher**: npmjs.com → `scoopjs` → Settings →
   Trusted publishing → GitHub Actions. Owner `joshthompson`, repository
   `scoopjs`, workflow `release.yml`. Then, under Publishing access, choose
   "require two-factor authentication and disallow tokens".
6. **Check the Action can publish**: add a small changeset
   (`pnpm changeset`), merge the "Version Packages" PR it opens, and watch
   `release.yml`. `changeset publish` uses `pnpm publish` in a pnpm repo, and
   this is the first time pnpm's OIDC support has been tried here. If it
   fails to authenticate, change the publish step to run `npm publish` for
   each package instead.
7. **Switch scoopbusrunclub to the published package**: in `apps/web` and
   `apps/run-game`, replace
   `"scoopjs": "link:../../../scoopjs/packages/core"` with
   `"scoopjs": "^0.1.0"`, run `pnpm install`, and commit. Only after this can
   `deploy-web.yml` build again.

Each new plugin repeats steps 4 and 5 for its own first publish.

## Working on ScoopJS and a game together

- In the game, run `pnpm link ~/Projects/scoopjs/packages/core`, or use the
  `link:` dependency as the monorepo does now. Run `pnpm build` (or
  `pnpm --filter scoopjs exec tsup --watch`) here, because the game reads
  `dist/`.
- The game's **Vite** config needs `resolve.dedupe: ['solid-js']`.
- The game's **tsconfig** needs `"solid-js"` and `"solid-js/*"` mapped under
  `paths` to its own `node_modules/solid-js`.
- Why both: a linked ScoopJS finds its own `solid-js` dev dependency first. In
  the bundle that means two Solids, and signals silently stop updating. In
  types it means two `JSX` namespaces, so `createController` can't infer a
  controller's data and falls back to `ControllerBaseType`. Installed from npm,
  ScoopJS shares the game's Solid, and both settings become harmless no-ops.
  scoopbusrunclub keeps them for the next time it links.
- **Publish before pushing the game.** CI installs from npm, so a game commit
  that needs an unreleased engine change breaks the deploy.

## What changed in scoopbusrunclub

- `apps/run-game`:
  - its 3 engine imports now come from `scoopjs`
  - `resolve.dedupe` and the `solid-js` paths added
  - `panda.config.ts`, the `@style` alias and the `styled-system` output
    removed; the Panda reset that output provided is kept as `src/reset.css`
  - `prepare-web` no longer runs Panda
  - the pause-shade override now sets `--scoopjs-modal-backdrop`
- `apps/web`:
  - the header's 15 files now import `scoopjs`
  - `ScoopBusHeader` passes `resolveAsset: seasonalAsset`
  - `resolve.dedupe` and the `solid-js` paths added
  - `src/engine`, `utils/SceneContext.ts`, `utils/blockBySolids.ts` and
    `utils/game.ts` deleted (only the engine used them)
- Checked:
  - both apps build, each bundle with one Solid
  - no new type errors: web 47 → 44 and run-game 7 → 0, all the removed ones
    in deleted engine files
  - biome is clean on the changed files
  - in headless Chrome, the header draws its 236 sprites, moves, and swaps
    in Halloween images on `setSeason('halloween')`; run-game races, and its
    pause screen keeps its own full-screen shade

## Later, in rough order

1. **Freediver adopts ScoopJS.** Its fork has drifted about 930 lines either
   way. Sort its additions:
   - its sounds (a Scene option that preloads `HTMLAudioElement`s) →
     `@scoopjs/sound`
   - its `Debugger` → `@scoopjs/debugger`
   - its dialogs: maybe `@scoopjs/dialog`, once they're no longer typed
     against freediver's own `Dialog`
   - its `GameState` store wired into `Scene`: freediver's own code, not a
     plugin
2. **run-game's generic pieces become plugins**, each pried out of run-game
   when it's worth it, while Core stays small:
   - `input.ts` (keyboard, touch, gamepad) → `@scoopjs/input`
   - `music/synth.ts` and the blip player in `sfx.ts` → `@scoopjs/synth`
   - `game/terrain.ts` and `game/platforms.ts` (the ground line and
     platforms) → `@scoopjs/terrain`
   - `courses/kit/seeded.ts`, and `ui/Stage.tsx` (a letterboxed stage), are
     candidates too
3. **The canvas renderer experiment**, to see whether drawing to a
   `<canvas>` is faster. When it happens, rename `Canvas`, and decide then
   whether a renderer interface has earned its place.
4. **A plugin registry**, only if three or more plugins want the same hook in
   the same way (ADR 0001).
