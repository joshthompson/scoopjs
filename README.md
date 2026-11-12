# ScoopJS

A game engine for SolidJS, where Solid components are the game objects.
Extracted from the [Scoop Bus Run Club](https://scoopbus.run) games.

| Package | What it is |
|---|---|
| [`@joshthompson/scoopjs`](packages/core) | Core: Scene, Controller, Sprite, Canvas and collision |

Optional extras will be plugin packages next to it (see
[docs/adr/0001](docs/adr/0001-plugins-are-composition.md)).

## Working on it

```sh
pnpm install
pnpm test        # Vitest
pnpm typecheck
pnpm lint        # biome
pnpm build
```

To try a change in a game before it's released, run `pnpm link
~/Projects/scoopjs/packages/core` in the game. The game's Vite config also
needs `resolve.dedupe: ['solid-js']`.

## Releasing

Run `pnpm changeset` with any change worth releasing, and commit the file it
writes. On `main`, the release Action keeps a "Version Packages" PR open, and
merging that PR publishes to GitHub Packages, for now. See
[plan.md](plan.md) for how publishing is set up.

Words used here: [GLOSSARY.md](GLOSSARY.md).
