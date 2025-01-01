/**
 * Check if the provided value is a JavaScript object (not null or undefined).
 *
 * @param object - The value to check.
 * @returns {boolean} - Returns true if the value is a JS object, otherwise false.
 */
export function isJsObject(object: any): boolean {
	return object !== null && object !== undefined && typeof object === 'object';
}
