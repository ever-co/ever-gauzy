/**
 * Checks if the given value is a valid object.
 *
 * Unlike `instanceof Object`, this method avoids cross-context issues.
 * Unlike `typeof`, it correctly excludes `null` and `undefined`, which are incorrectly classified as objects.
 *
 * @param {unknown} val - The value to check.
 * @returns {boolean} - Returns `true` if the value is an object, otherwise `false`.
 *
 * @example
 * console.log(isObject({})); // true
 * console.log(isObject(null)); // false
 * console.log(isObject(undefined)); // false
 * console.log(isObject([])); // true (arrays are also objects)
 * console.log(isObject(new Date())); // true
 */
export function isObject(val: unknown): val is object {
	return val !== null && val !== undefined && typeof val === 'object';
}
