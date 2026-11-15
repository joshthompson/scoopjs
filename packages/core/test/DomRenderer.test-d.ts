// Checked by `pnpm typecheck`, not run by Vitest: Vitest here has no Solid
// JSX transform, so it can't load the component itself.
import { describe, expectTypeOf, it } from 'vitest'
import {
	Canvas,
	type CanvasProps,
	DomRenderer,
	type DomRendererProps,
	type Scene,
	type Sprite,
} from '../src'

describe('DomRenderer', () => {
	// Games written before the rename still draw, through the same component.
	it('is still exported as the deprecated Canvas', () => {
		expectTypeOf(Canvas).toEqualTypeOf(DomRenderer)
		expectTypeOf<CanvasProps>().toEqualTypeOf<DomRendererProps>()
	})

	it('takes a scene to draw', () => {
		expectTypeOf(DomRenderer).parameter(0).toHaveProperty('scene')
		expectTypeOf<DomRendererProps['scene']>().toEqualTypeOf<Scene>()
	})

	// It draws each Controller from its `sprite()` alone, so a Draw Hook,
	// which only the Controller carries, never reaches it: one Controller can
	// keep its `children` for the DOM and use `draw` for canvas.
	it('ignores Draw Hooks, which a Sprite has no way to carry', () => {
		expectTypeOf<Sprite>().not.toHaveProperty('draw')
		expectTypeOf(DomRenderer).parameter(0).not.toHaveProperty('draw')
	})
})
