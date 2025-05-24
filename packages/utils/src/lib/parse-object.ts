import { isClassInstance } from './is-class-instance';
import { isObject } from './is-object';

/**
 * Recursively parses an object, applying a callback to all non-object leaf values.
 *
 * @param source - The object to parse.
 * @param callback - The function to apply to each primitive value.
 * @returns The modified object.
 */
export function parseObject<T extends object>(source: T, callback: (value: any) => any): T {
	if (!isObject(source)) {
		return source;
	}

	for (const key of Object.keys(source)) {
		const value = source[key];

		if (isObject(value)) {
			if (!isClassInstance(value)) {
				source[key] = parseObject(value, callback);
			}
		} else {
			source[key] = callback(value);
		}
	}

	return source;
}
