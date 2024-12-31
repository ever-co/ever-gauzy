/**
 * Check if the provided item is a function.
 * @param item - The item to check.
 * @returns {boolean} - Returns true if the item is a function, otherwise false.
 *
 * This function also ensures that the item is not an array,
 * as arrays are technically objects in JavaScript.
 */
export function isFunction(item: any): boolean {
	return typeof item === 'function' && !Array.isArray(item);
}
