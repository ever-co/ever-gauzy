import { isPlainObject } from './is-plain-object';

/**
 * Check if the item is a class instance (not a plain object).
 *
 * @param item - The item to check.
 * @returns {boolean} - Returns true if the item is a class instance, otherwise false.
 */
export function isClassInstance(item: any): boolean {
	return isPlainObject(item) && item.constructor.name !== 'Object';
}
