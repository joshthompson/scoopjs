import type { AnyController } from './Controller'
import type { Scene } from './Scene'
import { zIndex } from './styleTranslator'

/**
 * A Scene's own Controllers, not the attached ones, in `assetOrder`: the
 * order the DOM Renderer puts them on the page, the first at the bottom. A
 * type listed earlier is drawn over those after it, and a type that isn't
 * listed over all of them. Otherwise they're in the order they were added.
 */
export function sortByAssetOrder(scene: Scene): AnyController[] {
	// Where each type first comes in `assetOrder`, looked up once rather than
	// searched for on every comparison.
	const assetOrder = new Map<string, number>()
	for (const [index, type] of (
		scene.options.assetOrder?.flat() ?? []
	).entries()) {
		if (!assetOrder.has(type)) assetOrder.set(type, index)
	}
	const priority = (type: string) => assetOrder.get(type) ?? -1
	return scene.controllers
		.get()
		.map(({ controller }) => controller)
		.toSorted((a, b) => priority(b.type) - priority(a.type))
}

/**
 * Every Controller in a Scene, in the order they're drawn: the first at the
 * bottom, the last on top.
 */
export function drawOrder(scene: Scene): AnyController[] {
	const ordered: AnyController[] = []
	// Each Attached Controller straight after its carrier, in the order they
	// were attached, as they're nested inside it on the page. A carrier's
	// `transform` makes it a stacking context there, so its parts' `z-index`
	// only orders them among themselves and the carrier, which counts as 0:
	// a part below 0 goes under its carrier's Frame.
	const add = (carrier: AnyController) => {
		const level = [
			{ controller: carrier, z: 0 },
			...carrier.childControllers().map(withZIndex),
		]
		for (const { controller } of level.sort(byZIndex)) {
			if (controller === carrier) ordered.push(carrier)
			else add(controller)
		}
	}
	const top = sortByAssetOrder(scene).map(withZIndex).sort(byZIndex)
	for (const { controller } of top) add(controller)
	return ordered
}

/** A Controller with its style's `z-index`. */
function withZIndex(controller: AnyController) {
	return { controller, z: zIndex(controller.sprite().style) }
}

/** Lowest `z-index` first. Sorting is stable, so ties stay in order. */
const byZIndex = (a: { z: number }, b: { z: number }) => a.z - b.z
