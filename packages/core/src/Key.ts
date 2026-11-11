import { type Accessor, type Setter, createSignal } from 'solid-js'

class KeyController {
	#keys = new Map<string, [Accessor<boolean>, Setter<boolean>]>()
	#timeouts = new Map<string, number>()
	#onKeydown = (event: KeyboardEvent) => this.#get(event.key)[1](true)
	#onKeyup = (event: KeyboardEvent) => this.#get(event.key)[1](false)

	constructor() {
		if (typeof window === 'undefined') return
		window.addEventListener('keydown', this.#onKeydown)
		window.addEventListener('keyup', this.#onKeyup)
	}

	emulateKeydown(key: string, time = 100) {
		this.#get(key)[1](true)
		if (this.#timeouts.has(key)) {
			window.clearTimeout(this.#timeouts.get(key))
		}
		this.#timeouts.set(
			key,
			window.setTimeout(() => {
				this.#get(key)[1](false)
			}, time),
		)
	}

	destroy() {
		window.removeEventListener('keydown', this.#onKeydown)
		window.removeEventListener('keyup', this.#onKeyup)
	}

	isDown(key: string) {
		return this.#get(key)[0]()
	}

	#get(key: string) {
		if (!this.#keys.has(key)) {
			this.#keys.set(key, createSignal(false))
		}
		// biome-ignore lint/style/noNonNullAssertion: value guaranteed by surrounding logic
		return this.#keys.get(key)!
	}

	get(key: string) {
		return this.#get(key)[0]
	}
}

/** Which keys are down, as signals, from one set of listeners on `window`. */
export const Key = new KeyController()
