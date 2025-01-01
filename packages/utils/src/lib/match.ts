/**
 * Checks if a string matches a specified regular expression pattern.
 *
 * @param value - The string to test.
 * @param pattern - The regular expression pattern to match.
 * @returns True if the string matches the pattern; otherwise, false.
 *
 * @example
 * ```typescript
 * const isEmail = matchPattern("test@example.com", /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
 * ```
 */
export function matchPattern(value: string, pattern: RegExp): boolean {
	return pattern.test(value);
}
