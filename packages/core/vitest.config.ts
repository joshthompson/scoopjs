import { defineConfig } from 'vitest/config'

export default defineConfig({
	// Solid's browser build: its server build has no reactivity at all.
	resolve: {
		conditions: ['browser', 'development'],
	},
	test: {
		environment: 'jsdom',
		server: {
			deps: {
				inline: [/solid-js/],
			},
		},
	},
})
