/**
 * Check if a value is a string.
 *
 * @param val - The value to check.
 * @returns {boolean} - True if the value is a string, otherwise false.
 */
export function isString(val: any): val is string {
	return val != null && typeof val === 'string';
}
