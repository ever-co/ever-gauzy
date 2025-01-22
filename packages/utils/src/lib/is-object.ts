/**
/**
 * Simple object check.
 * @param val - The val to check.
 * @returns {boolean} - True if the val is an object and not an array, otherwise false.
 *
 * This implementation is based on common JavaScript patterns for type checking.
 * Reference: https://stackoverflow.com/a/34749873/772859
 */
export function isObject(val: any): boolean {
	return val !== null && typeof val === 'object' && !Array.isArray(val);
}
