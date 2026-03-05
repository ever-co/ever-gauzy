/**
 * Parses an environment variable with a fallback value.
 * Automatically handles type conversion based on the fallback type:
 * - Boolean: parses 'true'/'false' strings
 * - Number: parses numeric strings
 * - String: returns the value as-is
 *
 * @param value - Environment variable value
 * @param fallback - Fallback value if not set or invalid
 * @returns Parsed value matching the fallback type
 *
 * @example
 * ```typescript
 * // Boolean parsing
 * const isEnabled = parseEnvWithFallback(process.env.FEATURE_ENABLED, true);
 *
 * // Number parsing
 * const port = parseEnvWithFallback(process.env.PORT, 3000);
 *
 * // String parsing
 * const apiUrl = parseEnvWithFallback(process.env.API_URL, 'http://localhost:3000');
 * ```
 */
export function parseEnvWithFallback(value: string | undefined, fallback: boolean): boolean;
export function parseEnvWithFallback(value: string | undefined, fallback: number): number;
export function parseEnvWithFallback<T>(value: string | undefined, fallback: T): string | T;
export function parseEnvWithFallback<T>(value: string | undefined, fallback: T): boolean | number | string | T {
	// If value is undefined or empty, return fallback
	if (value === undefined || value === '') {
		return fallback;
	}

	// Boolean parsing
	if (typeof fallback === 'boolean') {
		const lower = value.trim().toLowerCase();
		if (lower === 'true') return true;
		if (lower === 'false') return false;
		return fallback;
	}

	// Number parsing
	if (typeof fallback === 'number') {
		const trimmed = value.trim();
		if (trimmed === '') return fallback;

		const parsed = Number(trimmed);
		return Number.isNaN(parsed) ? fallback : parsed;
	}

	// String or other types - return value as-is
	return value;
}
