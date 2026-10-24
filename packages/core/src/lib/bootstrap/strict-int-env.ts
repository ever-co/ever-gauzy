/**
 * Read a whole, non-negative number (milliseconds, a count) from an environment variable, strictly.
 *
 * `Number.parseInt` accepts a numeric prefix, so `2s` read as 2 and `1e3` as 1 — a unit suffix silently turned a
 * two-second deadline into two milliseconds. Only plain whole numbers are accepted here; anything else (a unit,
 * a fraction, a negative value) logs a warning and yields `fallback`. Unset or blank yields `fallback` silently.
 *
 * @param name - The variable's name, for the warning.
 * @param raw - Its value.
 * @param fallback - The value used when it is unset or invalid.
 */
export function readNonNegativeIntEnv(
	name: string,
	raw: string | undefined,
	fallback: number,
	logger: { warn: (message: string) => void } = console
): number {
	const value = String(raw ?? '').trim();
	if (!value) {
		return fallback;
	}
	const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
	if (!Number.isSafeInteger(parsed)) {
		logger.warn(`Ignoring invalid ${name} "${raw}": expected a whole number (no unit). Using ${fallback}.`);
		return fallback;
	}
	return parsed;
}
