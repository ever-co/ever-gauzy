/**
 * Remove duplicates from an array.
 *
 * @param collection - The array from which to remove duplicates.
 * @returns A new array with duplicate values removed.
 */
export function deduplicate<T = any>(collection: T[]): T[] {
	return [...new Set(collection)];
}
