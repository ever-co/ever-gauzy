import { isClassInstance, isObject } from '@gauzy/utils';

/**
 * Interface of the simple literal object with any string keys.
 */
export interface SimpleObjectLiteral {
	[key: string]: any;
}

/**
 * Parses the given value and converts it to a boolean using JSON.parse.
 *
 * @param value - The value to be parsed.
 * @returns {boolean} - The boolean representation of the parsed value.
 */
export const parseBool = (value: any): boolean => Boolean(JSON.parse(value));

/**
 * Converts native parameters based on the database connection type.
 *
 * @param parameters - The parameters to be converted.
 * @returns {any} - The converted parameters based on the database connection type.
 */
export const convertNativeParameters = (parameters: any): any => {
	try {
		// Mapping boolean values to their numeric representation
		if (Array.isArray(parameters)) {
			// If it's an array, process each element
			return parameters.map((item: any) => convertNativeParameters(item));
			// Mapping boolean values to their numeric representation
		} else if (typeof parameters === 'object' && parameters !== null) {
			// Recursively convert nested objects
			return Object.keys(parameters).reduce((acc, key) => {
				acc[key] = convertNativeParameters(parameters[key]);
				return acc;
			}, {} as SimpleObjectLiteral);
		} else {
			return parseBool(parameters);
		}
	} catch (error) {
		return parameters;
	}
};

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
