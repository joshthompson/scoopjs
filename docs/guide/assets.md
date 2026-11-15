# Assets

ScoopJS's assets are images: the Frames Sprites show, and any a [Draw
Hook](/renderers/draw-hooks) draws. Each is a URL.

## Image URLs

Anything that works as an `<img>`'s `src` works as a Frame:

- an image Vite imports, which gives its URL: `import busImage from './bus.png'`;
- a path to a file in the app's `public/` folder: `'/sprites/bus.png'`;
- a `data:` URL, such as a PNG or SVG the game makes itself.

A sprite sheet is one URL with a crop after it:
`url#x,y,width,height`. See [Sprite sheets](/guide/sprites-and-frames#sprite-sheets).

## Preloading

As a Scene starts, it loads images before anything moves. While it does,
it's paused and `scene.loading.get()` is true. It loads:

- the `frames` option of each Controller added in `setup`;
- every URL in the Scene's `images` option.

Each goes through the Asset Resolver first, so it's the image that will
actually be shown that's loaded. An image that fails to load doesn't stop
the Scene; it's counted as done.

Frames given some other way aren't preloaded: those of Attached
Controllers, those in a `frames` signal in a Controller's data, those of
Controllers added after `setup`, and images a Draw Hook draws. List them in
`images` to load them up front:

```ts
import { Scene } from 'scoopjs'
import explosion from './explosion.png'
import hatImage from './hat.png'

const scene = new Scene('level', {
	width: 960,
	height: 540,
	// Shown later, by Attached Controllers and Controllers added mid-game
	images: [hatImage, explosion],
})
```

`scene.loadingAssetCount` and `scene.loadingAssetTotal` count the images as
they load, for a loading screen: see [Loading](/guide/scenes#loading).

## The Asset Resolver

The **Asset Resolver** is a function a game gives a Scene, as its
`resolveAsset` option, to swap an image for the one to actually show. It's
given each URL and gives back the one to use:

```ts
import { Scene } from 'scoopjs'
import { createSignal } from 'solid-js'

const [season, setSeason] = createSignal<'summer' | 'winter'>('summer')

const scene = new Scene('park', {
	width: 960,
	height: 540,
	// tree.png shows as tree-winter.png in winter
	resolveAsset: (url) =>
		season() === 'winter' ? url.replace(/\.png$/, '-winter.png') : url,
})

setSeason('winter')
```

Every image goes through it:

- each Frame of each Sprite, under both Renderers;
- the images the Scene preloads;
- the images a Draw Hook asks for with `image(url)`.

It can read signals, as the one above does. Sprites follow whatever it
gives back, so changing the season swaps every image on the screen.
`scene.resolveAsset(url)` calls it, for a game's own code.

## Under the Canvas Renderer

The Canvas Renderer loads each image itself, once, the first time
something shows it, and paints again when it's loaded. Until then that
Sprite has nothing to paint. Preloading means the browser already has it,
so there's no gap.

An image that fails to load is a [Canvas Issue](/renderers/canvas-issues),
`image`, reported once per Controller type, with its URL.

To recolour an image, the Canvas Renderer has to read its pixels on WebKit
(see [WebKit](/renderers/canvas-renderer#webkit-and-colour-filters)). An image
from another site can only be read if that site allows it with CORS, so
serve images from the game's own site.
