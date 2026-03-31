/**
 * Escapes a string so it can be safely embedded inside a single-quoted
 * JavaScript string literal in generated source code.
 *
 * Handles backslashes, single quotes, and newline characters that would
 * otherwise break or alter the emitted string.
 *
 * @param value - The raw string to escape.
 * @returns The escaped string, safe for single-quote interpolation.
 */
export function escapeForSingleQuote(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
