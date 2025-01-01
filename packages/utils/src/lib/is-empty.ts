/**
 * Check if the provided value is empty.
 * This function checks for various types of values:
 * - Arrays: Returns true if the array is empty after filtering out any empty values.
 * - Objects: Returns true if the object has no own properties after removing null, undefined, or empty string properties.
 * - Other types: Returns true for null, undefined, or string representations of 'null' or 'undefined'.
 *
 * @param item - The value to check for emptiness.
 * @returns {boolean} - Returns true if the value is empty, otherwise false.
 */
export function isEmpty(item: any): boolean {
	if (Array.isArray(item)) {
		// Filter out any empty values from the array
		item = item.filter((val) => !isEmpty(val));
		return item.length === 0;
	} else if (item && typeof item === 'object') {
		// Remove null, undefined, or empty string properties
		for (const key in item) {
			if (item[key] === null || item[key] === undefined || item[key] === '') {
				delete item[key];
			}
		}
		return Object.keys(item).length === 0;
	} else {
		// Check for non-object/array values
		return !item || (item + '').toLowerCase() === 'null' || (item + '').toLowerCase() === 'undefined';
	}
}
