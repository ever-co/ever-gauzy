import { isFunction } from './is-function'; // Ensure the import path is correct.
import { isPlainObject } from './is-plain-object';

/**
 * Check if the item is either an object or a function.
 *
 * @param item - The item to check.
 * @returns {boolean} - Returns true if the item is an object or function, otherwise false.
 */
export function isObjectOrFunction(item: any): boolean {
	return isFunction(item) || isPlainObject(item);
}
