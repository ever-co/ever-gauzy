/**
 * Checks if a value is not null or undefined.
 *
 * @param value - The value to be checked.
 * @returns True if the value is not null or undefined; otherwise, false.
 *
 * @example
 * ```typescript
 * const result = isNotNullOrUndefined(someValue);
 * ```
 */
export function isNotNullOrUndefined<T>(value: T | undefined | null): value is T {
	return value !== undefined && value !== null;
}
