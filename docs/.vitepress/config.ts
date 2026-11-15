import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitepress'

// The version in the nav is Core's own, read at build time, so a release
// shows on the site without anyone remembering to change it here.
const { version } = JSON.parse(
	readFileSync(
		new URL('../../packages/core/package.json', import.meta.url),
		'utf8',
	),
) as { version: string }

const repo = 'https://github.com/joshthompson/scoopjs'

export default defineConfig({
	title: 'ScoopJS',
	description:
		'A game engine for SolidJS, where Solid components are the game objects',
	// A project site: https://joshthompson.github.io/scoopjs/
	base: '/scoopjs/',
	lang: 'en-GB',
	themeConfig: {
		nav: [
			{
				text: 'Guide',
				link: '/getting-started',
				activeMatch: '^/(getting-started|guide/)',
			},
			{ text: 'Renderers', link: '/renderers/', activeMatch: '^/renderers/' },
			{ text: 'API', link: '/api' },
			{
				text: `v${version}`,
				items: [
					{ text: 'Versions', link: '/versions' },
					{ text: 'Changelog', link: '/changelog' },
				],
			},
		],
		sidebar: [
			{
				text: 'Introduction',
				items: [
					{ text: 'What ScoopJS is', link: '/' },
					{ text: 'Getting started', link: '/getting-started' },
				],
			},
			{
				text: 'Guide',
				items: [
					{ text: 'Scenes', link: '/guide/scenes' },
					{ text: 'Controllers', link: '/guide/controllers' },
					{ text: 'Attached Controllers', link: '/guide/attached-controllers' },
					{ text: 'Sprites and Frames', link: '/guide/sprites-and-frames' },
					{ text: 'Collision', link: '/guide/collision' },
					{ text: 'Input', link: '/guide/input' },
					{ text: 'Assets', link: '/guide/assets' },
					{ text: 'Plugins', link: '/guide/plugins' },
				],
			},
			{
				text: 'Renderers',
				items: [
					{ text: 'Choosing a Renderer', link: '/renderers/' },
					{ text: 'DOM Renderer', link: '/renderers/dom-renderer' },
					{ text: 'Canvas Renderer', link: '/renderers/canvas-renderer' },
					{ text: 'Draw Hooks', link: '/renderers/draw-hooks' },
					{ text: 'Canvas Issues', link: '/renderers/canvas-issues' },
					{
						text: 'Moving to the Canvas Renderer',
						link: '/renderers/moving-to-canvas',
					},
				],
			},
			{
				text: 'Reference',
				items: [
					{ text: 'API', link: '/api' },
					{ text: 'Glossary', link: '/glossary' },
				],
			},
			{
				text: 'Project',
				items: [
					{ text: 'Versions', link: '/versions' },
					{ text: 'Changelog', link: '/changelog' },
					{
						text: 'Decisions',
						link: '/adr/',
						collapsed: false,
						items: [
							{
								text: '0001: Plugins are composition',
								link: '/adr/0001-plugins-are-composition',
							},
							{
								text: '0002: The Canvas Renderer translates or reports',
								link: '/adr/0002-canvas-renderer-translates-or-reports',
							},
						],
					},
				],
			},
		],
		socialLinks: [{ icon: 'github', link: repo }],
		editLink: {
			pattern: `${repo}/edit/main/docs/:path`,
			text: 'Edit this page on GitHub',
		},
		search: { provider: 'local' },
		outline: { level: [2, 3] },
		footer: {
			message: 'Released under the MIT Licence.',
		},
	},
})
