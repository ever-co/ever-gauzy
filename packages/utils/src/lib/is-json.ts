/**
 * Checks if a given input is a valid JSON string.
 *
 * @param {unknown} input - The input value to check.
 * @returns {boolean} - Returns `true` if the input is a valid JSON string, otherwise `false`.
 *
 * @example
 * console.log(isJSON('{"name": "John", "age": 30}')); // true
 * console.log(isJSON('{name: John, age: 30}')); // false
 * console.log(isJSON(123)); // false
 * console.log(isJSON(null)); // false
 */
export function isJSON(input: unknown): boolean {
	if (typeof input !== 'string') return false;
	try {
		JSON.parse(input);
		return true;
	} catch {
		return false;
	}
}
