// Checked by `pnpm typecheck`, not run by Vitest: Vitest here has no Solid
// JSX transform, so it can't load the component itself. What it paints is
// tested through the painter it puts on the page, in canvasPainter.test.ts.
import { describe, expectTypeOf, it } from 'vitest'
import {
	CanvasRenderer,
	type CanvasRendererProps,
	type DomRendererProps,
} from '../src'

describe('CanvasRenderer', () => {
	// A game switches Renderer by mounting the other one, props and all
	it("takes every one of the DOM Renderer's props", () => {
		expectTypeOf<DomRendererProps>().toMatchTypeOf<CanvasRendererProps>()
		expectTypeOf(CanvasRenderer)
			.parameter(0)
			.toEqualTypeOf<CanvasRendererProps>()
	})

	it('can turn smoothing off for pixel art', () => {
		expectTypeOf<CanvasRendererProps['pixelated']>().toEqualTypeOf<
			boolean | undefined
		>()
	})
})
