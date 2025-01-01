/**
 * Check if a value is defined (not undefined).
 *
 * @param val - The value to check.
 * @returns True if the value is defined, otherwise false.
 */
export function isDefined<T = undefined | unknown>(val: T): val is T extends undefined ? never : T {
	return typeof val !== 'undefined';
}
