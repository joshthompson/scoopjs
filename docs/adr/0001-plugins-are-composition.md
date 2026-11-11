# Plugins are built on Core's API, not registered with it

A Plugin is its own `@scoopjs/*` package that a game calls directly, such as `const sounds = createSounds(scene, {...})` or `<Debugger scene={scene} />`. Core has no list of plugins, no `plugins: [...]` option on a Scene, and no lifecycle for them. When a Plugin needs a hook Core doesn't have yet, Core gains that hook as ordinary public API that any game could use too.

## Considered Options

- **A registry**: `new Scene({ plugins: [sounds(), dialog()] })`, with setup, before-tick, after-tick and overlay hooks. It's tidier where the game sets up its Scene. We rejected it because no Plugins exist yet, so the hooks would be a guess. Plugins that add state of their own would also end up as `scene.plugins.dialog`, which is awkward to type, while a function's return value is typed for free.

## Consequences

- If three or more Plugins end up wanting the same hook in the same way, that's the time to think about a registry again.
- Each Plugin lists `scoopjs` and `solid-js` as peer dependencies, so a game and all its Plugins share one Core and one Solid.
