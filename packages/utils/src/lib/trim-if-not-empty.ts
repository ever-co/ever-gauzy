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
	if (!isNotEmpty(value)) {
		return undefined;
	}
	// A whitespace-only value passes the emptiness check above but is empty once trimmed.
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
};
