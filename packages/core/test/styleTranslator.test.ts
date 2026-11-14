import { describe, expect, it } from 'vitest'
import { translateStyle } from '../src/styleTranslator'

// What the painter draws from a style is tested through the painter. This is
// what the Canvas Renderer reports as Canvas Issues: what it leaves out.
describe("the style a canvas can't draw", () => {
	it('is every key outside the translated ones', () => {
		const { untranslatable } = translateStyle({
			opacity: 0.5,
			visibility: 'hidden',
			display: 'none',
			'z-index': 2,
			transform: 'scale(2)',
			translate: '1px 2px',
			'transform-origin': 'center',
			filter: 'sepia(1)',
			'clip-path': 'circle(50%)',
			transition: 'opacity 1s',
			background: 'linear-gradient(red, blue)',
		})
		expect(untranslatable).toEqual(['clip-path', 'transition', 'background'])
	})

	it('leaves out keys with no value, as the page does', () => {
		const { untranslatable } = translateStyle({
			'clip-path': undefined,
			'border-radius': '',
		})
		expect(untranslatable).toEqual([])
	})

	it('is every filter function outside the supported set, or that it cannot read', () => {
		const { unsupportedFilters } = translateStyle({
			filter:
				'hue-rotate(30deg) blur(2px) brightness(-1) drop-shadow(1em 1em) contrast(2) url(#glow)',
		})
		expect(unsupportedFilters).toEqual([
			'blur',
			'brightness',
			'drop-shadow',
			'contrast',
			'url',
		])
	})

	it('is any drop-shadow after the first, since a canvas casts only one', () => {
		const { unsupportedFilters } = translateStyle({
			filter: 'drop-shadow(1px 0 white) drop-shadow(-1px 0 white)',
		})
		expect(unsupportedFilters).toEqual(['drop-shadow'])
	})

	it('is a filter it cannot read at all', () => {
		expect(
			translateStyle({ filter: 'sepia(1) glow' }).unsupportedFilters,
		).toEqual(['glow'])
		expect(translateStyle({ filter: 'none' }).unsupportedFilters).toEqual([])
	})
})
