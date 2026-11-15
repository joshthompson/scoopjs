import type { Scene } from './Scene'
import type { Sprite } from './components/Sprite'

/**
 * The `children` a Sprite draws inside itself, still to be called if they're
 * a function: none with the Scene's `skipChildren` bench switch on. The DOM
 * Sprite draws whatever this gives, and the Canvas Renderer reports it, so
 * the switch means the same to both.
 */
export function childrenToDraw(
	scene: Scene,
	sprite: Pick<Sprite, 'children'>,
): Sprite['children'] {
	return scene.options.skipChildren ? undefined : sprite.children
}
