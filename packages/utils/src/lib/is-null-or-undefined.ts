/**
 * Checks if a value is null or undefined.
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597
 *
 * @param value - The value to check.
 * @returns True if the value is null or undefined; otherwise, false.
 *
 * @example
 * ```typescript
 * const result = isNullOrUndefined(someValue);
 * ```
 */
export function isNullOrUndefined<T>(value: T | null | undefined): value is null | undefined {
	return value === undefined || value === null;
}
