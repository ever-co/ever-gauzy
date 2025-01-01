/**
/**
 * Simple object check.
 * @param item - The item to check.
 * @returns {boolean} - True if the item is an object and not an array, otherwise false.
 *
 * This implementation is based on common JavaScript patterns for type checking.
 * Reference: https://stackoverflow.com/a/34749873/772859
 */
export function isObject(item: any): boolean {
	return item !== null && typeof item === 'object' && !Array.isArray(item);
}
