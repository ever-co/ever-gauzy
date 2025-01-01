/**
 * Check if a value is a valid Date.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a valid Date, otherwise false.
 */
export function isDate(value: any): value is Date {
	return value !== null && !isNaN(new Date(value).valueOf());
}
