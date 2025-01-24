/**
 * Checks if the given value is a valid object.
 *
 * Unlike `instanceof Object`, this method avoids cross-context issues.
 * Unlike `typeof`, it correctly excludes `null`, which is mistakenly classified as an object.
 *
 * @param {unknown} val - The value to check.
 * @returns {boolean} - Returns `true` if the value is an object, otherwise `false`.
 *
 * @example
 * console.log(ObjectUtils.isObject({})); // true
 * console.log(ObjectUtils.isObject(null)); // false
 * console.log(ObjectUtils.isObject([])); // true (arrays are also objects)
 * console.log(ObjectUtils.isObject('text')); // false
 */
export function isObject(val: unknown): val is object {
	return val !== null && typeof val === 'object';
}
