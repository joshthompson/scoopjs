import { defineConfig } from 'tsup'
import * as preset from 'tsup-preset-solid'

/**
 * Built twice over, the way Solid libraries are: `dist/index.jsx` keeps its
 * JSX for the `solid` export condition, so a game's own `vite-plugin-solid`
 * compiles it against the game's one copy of Solid, and `dist/index.js` is
 * compiled already for anything that doesn't ask for `solid`.
 */
const options: preset.PresetOptions = {
	entries: { entry: 'src/index.tsx' },
	drop_console: false,
	out_dir: 'dist',
}

export default defineConfig((config) => {
	const watching = !!config.watch
	const parsed = preset.parsePresetOptions(options, watching)
	return preset.generateTsupOptions(parsed)
})
