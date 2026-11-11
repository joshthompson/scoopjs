import type { Component, JSX } from 'solid-js'

/**
 * Shown over a scene while `scene.modal` is set, which pauses it. The shade
 * behind it is `--scoopjs-modal-backdrop`, for a game to set on its canvas
 * (`transparent` for none).
 */
export const Modal: Component<{ children: JSX.Element }> = (props) => {
	return (
		<div data-scoopjs-modal style={styles.background}>
			<div style={styles.modal}>{props.children}</div>
		</div>
	)
}

const styles = {
	background: {
		position: 'absolute',
		inset: 0,
		width: '100%',
		height: '100%',
		background: 'var(--scoopjs-modal-backdrop, rgba(0, 0, 0, 0.5))',
	},
	modal: {
		position: 'absolute',
		top: '50%',
		left: '1rem',
		right: '1rem',
		transform: 'translateY(-50%)',
		'border-radius': '2rem',
		overflow: 'hidden',
	},
} satisfies Record<string, JSX.CSSProperties>
