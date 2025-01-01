// The solution here is adapted from: https://github.com/typestack/class-transformer/issues/676#issuecomment-822699830

/**
 * A map for converting string representations of boolean values to their respective boolean,
 * `null`, or `undefined` values. Useful for transforming string inputs into typed booleans
 * when dealing with user input or API responses.
 *
 * - `"true"` and `"1"` will be converted to `true`
 * - `"false"` and `"0"` will be converted to `false`
 * - `"null"` will be converted to `null`
 * - `"undefined"` will be converted to `undefined`
 *
 * @example
 * ```typescript
 * // Direct usage of the map
 * console.log(BooleanMapper.get("true")); // Output: true
 * console.log(BooleanMapper.get("false")); // Output: false
 * console.log(BooleanMapper.get("null")); // Output: null
 * console.log(BooleanMapper.get("undefined")); // Output: undefined
 * console.log(BooleanMapper.get("1")); // Output: true
 * console.log(BooleanMapper.get("0")); // Output: false
 *
 * // Usage in a transformation function
 * function transformToBoolean(value: string): boolean | null | undefined {
 *   return BooleanMapper.get(value.toLowerCase().trim());
 * }
 *
 * console.log(transformToBoolean("true")); // Output: true
 * console.log(transformToBoolean("0"));    // Output: false
 * console.log(transformToBoolean("null")); // Output: null
 * ```
 */
export const BooleanMapper = new Map<string, boolean | null | undefined>([
	["undefined", undefined],
	["null", null],
	["true", true],
	["false", false],
	["1", true],
	["0", false],
]);

/**
 * Converts a string representation of a boolean to its corresponding value
 * based on `BooleanMapper`.
 *
 * @param value - The string value to convert.
 * @returns The mapped boolean value, `null`, or `undefined`.
 *
 * @example
 * ```typescript
 * mapToOptionalBoolean("true"); // Output: true
 * mapToOptionalBoolean("false"); // Output: false
 * mapToOptionalBoolean("null"); // Output: null
 * mapToOptionalBoolean("undefined"); // Output: undefined
 * mapToOptionalBoolean("1"); // Output: true
 * mapToOptionalBoolean("0"); // Output: false
 * mapToOptionalBoolean("invalid"); // Output: undefined (not mapped)
 * ```
 */
export function mapToOptionalBoolean(value: string): boolean | null | undefined {
	return BooleanMapper.get(value.toLowerCase().trim());
}
