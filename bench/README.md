# Stress page

N moving, animated, rotated Sprites, from 100 to 5,000, under the DOM Renderer or the Canvas Renderer, with the frame time shown above them. It's for comparing how fast the two Renderers draw, by hand. It isn't part of the published package or of CI.

## Start it

From the repo root:

```sh
pnpm bench
```

That builds Core, then serves the page at <http://localhost:5180/bench/>. Set `PORT` to use another port. To open it on a phone on the same network, start it with `HOST=0.0.0.0 pnpm bench` and visit your computer's address on that port; anyone on the network can then read the repo's files through it, so stop it afterwards.

The page is plain JavaScript against Core as built (`packages/core/dist`), with an import map for Solid, so it needs no JSX and nothing beyond what Core already installs. After changing Core, run `pnpm bench` again, or `pnpm build` with the server still running, then reload.

## Using it

- **Sprites**: how many there are.
- **DOM Renderer / Canvas Renderer**: which one draws them.
- **skipChildren**: the Scene's bench switch. Each Sprite has a number drawn inside it as `children`, as most of run-game's art is. The DOM Renderer draws it unless the switch is on; the Canvas Renderer never does. Turn it on to compare the two drawing the same thing.

The settings are kept in the page's address, so a reload, or a link to someone else, keeps them. Each change starts a fresh Scene.

The figures are taken over each second: frames a second, then the mean, the slowest 5% and the slowest frame time, timed with `requestAnimationFrame`. The Scene ticks every 16 ms, so every display frame has something to draw. Measure with DevTools closed, and on the phone itself for the figures that count; a headless browser caps itself at 30 frames a second.
