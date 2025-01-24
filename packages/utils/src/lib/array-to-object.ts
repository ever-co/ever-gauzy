/**
 * Converts an array of objects into a key-value object based on specified properties.
 *
 * @template T - Type of objects within the array.
 * @template K - Key property type (extends keyof T).
 * @template V - Value property type (extends keyof T).
 *
 * @param {T[]} array - The input array of objects.
 * @param {K} key - The property name to be used as the object key.
 * @param {V} value - The property name to be used as the object value.
 * @returns {Record<string, any>} - The resulting object mapping keys to values.
 *
 * @example
 * const users = [
 *   { id: 1, name: 'John' },
 *   { id: 2, name: 'Jane' }
 * ];
 * const userMap = arrayToObject(users, 'id', 'name');
 * console.log(userMap); // { "1": "John", "2": "Jane" }
 */
export function arrayToObject<T, K extends keyof T, V extends keyof T>(
	array: T[],
	key: K,
	value: V
): Record<string, any> {
	return array.reduce((acc: Record<string, any>, item: T) => {
		acc[String(item[key])] = item[value];
		return acc;
	}, {});
}
