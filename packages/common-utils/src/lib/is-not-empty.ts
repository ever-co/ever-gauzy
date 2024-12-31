import { isEmpty } from './is-empty';

/**
 * Check if the provided value is not empty.
 * This function utilizes the isEmpty function to determine if the value has content.
 *
 * @param item - The value to check for non-emptiness.
 * @returns {boolean} - Returns true if the value is not empty, otherwise false.
 */
export function isNotEmpty(item: any): boolean {
	return !isEmpty(item);
}
