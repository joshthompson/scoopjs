# ScoopJS plan

The plan for moving the Scoop Bus Run Club game engine into this repo and
publishing it as a package. Until the npm name is settled, that package is
**`@joshthompson/scoopjs` on GitHub Packages**, and games install it under the
alias `scoopjs`. This file records what was decided and why, what has been
done, and what's left.

Decided on 11 November 2026. The decision is recorded in the monorepo as
`docs/adr/0004-engine-is-the-scoopjs-package.md`.

## Status

- [x] Repo set up at `~/Projects/scoopjs`: workspace, core package, tests,
      CI and release workflows, docs
- [x] Core extracted from `scoopbusrunclub/apps/web/src/engine` (at
      `12469dd`), with no Scoop Bus code left in it
- [x] run-game and the website header switched to `scoopjs`, through a
      local `link:` for now; `apps/web/src/engine` deleted
- [x] scoopbusrunclub ready to install from GitHub Packages: `.npmrc` scope
      line, and a login step and `packages: read` in its deploy workflows
- [ ] First commit, then the public GitHub repo (`joshthompson/scoopjs`)
- [ ] First push to `main` publishes `@joshthompson/scoopjs@0.1.0`
- [ ] The package lets scoopbusrunclub's Actions read it
- [ ] A token on this laptop that can read GitHub Packages
- [ ] scoopbusrunclub switched from `link:` to
      `"scoopjs": "npm:@joshthompson/scoopjs@^0.1.0"`, then committed
- [ ] Later: settle the npm name and move there (see [Registry](#registry))

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
3. **Plugins are composition.** An optional extra is a package of its own,
   built only on Core's public API. Core has no plugin registry. See
   [docs/adr/0001](docs/adr/0001-plugins-are-composition.md).
4. **One Solid.** Core and every plugin list `solid-js` as a peer
   dependency, and plugins list Core as one too.

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
| Registry | GitHub Packages for now, as `@joshthompson/scoopjs`, until the npm name is settled | Publishing to npm straight away |
| Name in games | The alias `scoopjs` (`"scoopjs": "npm:@joshthompson/scoopjs@^0.1.0"`), so moving registry or renaming changes one line per game, not every import | Importing `@joshthompson/scoopjs` directly |
| Package format | Compiled ESM, plus a `solid` export condition carrying the JSX, built by `tsup-preset-solid`; `solid-js` as a peer dependency | Shipping only compiled output |
| Versions | Changesets, every package on one version number during 0.x | Independent versions |
| Publishing | GitHub Action (`changesets/action`), with the repo's own `GITHUB_TOKEN` | Publishing by hand |
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
│   └── core/               # `@joshthompson/scoopjs`, for now
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

Plugins go next to `core` as `packages/<name>`. Their names wait on the
registry decision below: on GitHub Packages they'd have to be
`@joshthompson/scoopjs-<name>`. Once there are two or more packages, list them
all in one group under `fixed` in `.changeset/config.json`. It's empty for now
because a group of one does nothing.

## Registry

For now ScoopJS is published to **GitHub Packages**, because the npm name isn't
settled. GitHub Packages names have to be scoped to the GitHub account that
owns them, so it's `@joshthompson/scoopjs`. The catch: GitHub Packages wants a
token **even to install**, public package or not. That means a token on every
machine and in every CI job that installs ScoopJS.

Games depend on it under the alias `scoopjs`, so their code imports
`from 'scoopjs'` whatever the package is really called:

```json
"scoopjs": "npm:@joshthompson/scoopjs@^0.1.0"
```

with this in the game's `.npmrc`:

```
@joshthompson:registry=https://npm.pkg.github.com
```

**Moving to npm later**, once the name is settled (`scoopjs` and the npm org
`scoopjs` were both free on 11 November 2026):
1. Rename the package and remove `publishConfig.registry` here.
2. Publish the first version by hand. npm can only attach a trusted
   publisher to a package that already exists.
3. Attach a trusted publisher (GitHub Actions, workflow `release.yml`), and
   change `release.yml` to `id-token: write`, `NPM_CONFIG_PROVENANCE: true`
   and no GitHub Packages login.
4. In each game, point the alias at the npm name, then drop the `.npmrc`
   scope line and the GitHub Packages login from CI.

## Bootstrap

Steps only Josh can do, in order:

1. **Commit** in `~/Projects/scoopjs`: "Extracted from
   scoopbusrunclub@12469dd".
2. **Create the GitHub repo and push**:
   `gh repo create joshthompson/scoopjs --public --source ~/Projects/scoopjs --push`
   `release.yml` runs on that push. There are no changesets, so it publishes
   the version in `package.json`, **0.1.0**, which creates the package.
3. **Check the package**: github.com/joshthompson?tab=packages →
   `scoopjs`. It should be linked to the `scoopjs` repo; `repository` in
   `package.json` does that. Set its visibility to public if you like.
   Installing still needs a token either way.
4. **Let scoopbusrunclub's Actions read it**: the package's settings →
   Manage Actions access → Add repository → `scoopbusrunclub`, role Read.
   Without this, `deploy-web.yml` can't install it.
5. **Give this laptop a token**, for pnpm to install it:
   ```sh
   gh auth refresh -s read:packages
   npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
   ```
   That puts the token in `~/.npmrc`. If GitHub Packages rejects the `gh`
   token, use a classic personal access token with `read:packages` instead.
   GitHub Packages doesn't take fine-grained tokens.
6. **Switch scoopbusrunclub to the published package**: in `apps/web` and
   `apps/run-game`, replace
   `"scoopjs": "link:../../../scoopjs/packages/core"` with
   `"scoopjs": "npm:@joshthompson/scoopjs@^0.1.0"`, run `pnpm install`, and
   commit. Only after this can `deploy-web.yml` build again.

Later releases need nothing extra: add a changeset, then merge the "Version
Packages" PR.

## Working on ScoopJS and a game together

- In the game, run `pnpm link ~/Projects/scoopjs/packages/core`, or use the
  `link:` dependency as the monorepo does now. Run `pnpm build` (or
  `pnpm --filter @joshthompson/scoopjs exec tsup --watch`) here, because the game reads
  `dist/`.
- The game's **Vite** config needs `resolve.dedupe: ['solid-js']`.
- The game's **tsconfig** needs `"solid-js"` and `"solid-js/*"` mapped under
  `paths` to its own `node_modules/solid-js`.
- Why both: a linked ScoopJS finds its own `solid-js` dev dependency first. In
  the bundle that means two Solids, and signals silently stop updating. In
  types it means two `JSX` namespaces, so `createController` can't infer a
  controller's data and falls back to `ControllerBaseType`. Installed from a
  registry, ScoopJS shares the game's Solid, and both settings become harmless
  no-ops.
  scoopbusrunclub keeps them for the next time it links.
- **Publish before pushing the game.** CI installs from the registry, so a game commit
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
- The root:
  - `.npmrc` maps `@joshthompson` to GitHub Packages
  - `deploy-web.yml` writes a GitHub Packages login from `GITHUB_TOKEN`
    before installing, and it and `deploy.yml` grant `packages: read`
- Checked:
  - both apps build, each bundle with one Solid
  - no new type errors: web 47 → 44 and run-game 7 → 0, all the removed ones
    in deleted engine files
  - biome is clean on the changed files
  - in headless Chrome, the header draws its 236 sprites, moves, and swaps
    in Halloween images on `setSeason('halloween')`; run-game races, and its
    pause screen keeps its own full-screen shade

## Later, in rough order

1. **Settle the name and move to npm**, so installing needs no token (see
   [Registry](#registry)). Do it before the first plugin, so plugins get
   their final names from the start.
2. **Freediver adopts ScoopJS.** Its fork has drifted about 930 lines either
   way. Sort its additions:
   - its sounds (a Scene option that preloads `HTMLAudioElement`s) → a `sound` plugin
   - its `Debugger` → a `debugger` plugin
   - its dialogs: maybe a `dialog` plugin, once they're no longer typed
     against freediver's own `Dialog`
   - its `GameState` store wired into `Scene`: freediver's own code, not a
     plugin
3. **run-game's generic pieces become plugins**, each pried out of run-game
   when it's worth it, while Core stays small:
   - `input.ts` (keyboard, touch, gamepad) → an `input` plugin
   - `music/synth.ts` and the blip player in `sfx.ts` → a `synth` plugin
   - `game/terrain.ts` and `game/platforms.ts` (the ground line and
     platforms) → a `terrain` plugin
   - `courses/kit/seeded.ts`, and `ui/Stage.tsx` (a letterboxed stage), are
     candidates too
4. **The canvas renderer experiment**, to see whether drawing to a
   `<canvas>` is faster. When it happens, rename `Canvas`, and decide then
   whether a renderer interface has earned its place.
5. **A plugin registry**, only if three or more plugins want the same hook in
   the same way (ADR 0001).
