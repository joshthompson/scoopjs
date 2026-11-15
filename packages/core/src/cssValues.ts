/**
 * Reading CSS values as the page would, for the Canvas Renderer, which has
 * to work out for itself what a style says.
 */

/** A value that's been left out, as Solid leaves it off the page. */
export const absent = (value: unknown) =>
	value === undefined || value === null || value === ''

/**
 * A CSS length in pixels, or undefined for anything else. A percentage is
 * one of `size`, where there's a size to take it of. Only a bare 0 goes
 * without a unit.
 */
export function length(value: string, size?: number) {
	const number = (text: string) =>
		text.trim() === '' ? undefined : finite(Number(text))
	if (value.endsWith('%') && size !== undefined) {
		const percent = number(value.slice(0, -1))
		return percent === undefined ? undefined : (percent / 100) * size
	}
	if (value.endsWith('px')) return number(value.slice(0, -2))
	return number(value) === 0 ? 0 : undefined
}

const finite = (n: number) => (Number.isFinite(n) ? n : undefined)

const turns: Record<string, number> = {
	deg: 1,
	rad: 180 / Math.PI,
	grad: 0.9,
	turn: 360,
}

/** A CSS angle in degrees, or undefined for anything else. */
export function angle(value: string) {
	const unit = value.match(/[a-z]+$/)?.[0]
	if (!unit) return Number(value) === 0 ? 0 : undefined
	const scale = turns[unit]
	return scale === undefined ? undefined : Number.parseFloat(value) * scale
}
