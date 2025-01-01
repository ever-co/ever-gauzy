import { isNotEmpty } from './is-not-empty';

/**
 * Trims a string value and returns it if not empty; otherwise, returns undefined.
 *
 * @param value - The string value to trim.
 * @returns Trimmed string value or undefined if the input is empty or undefined.
 *
 * @example
 * ```typescript
 * trimIfNotEmpty("  example  "); // Output: "example"
 * trimIfNotEmpty("   ");         // Output: undefined (empty after trimming)
 * trimIfNotEmpty("");            // Output: undefined
 * trimIfNotEmpty(undefined);     // Output: undefined
 * ```
 */
export const trimIfNotEmpty = (value?: string): string | undefined => {
	return isNotEmpty(value) ? value.trim() : undefined;
};
