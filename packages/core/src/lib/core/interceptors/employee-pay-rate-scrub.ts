/**
 * The employee columns that hold salary data. A caller-supplied `select` (`?select[payRateValue]=true`, or nested
 * through a team's or a time log's employee) can load them on a generic read, so every serialized row loses them. The
 * pay rate route answers an object without an `id` (`IEmployeePayRate`), the one shape allowed to carry them.
 */
export const EMPLOYEE_PAY_RATE_KEYS: ReadonlyArray<string> = ['payRateValue', 'payRateCurrency'];

/**
 * Removes the pay rate from one serialized row (an object with an `id`), in place.
 *
 * @param node A plain object of a response body.
 */
export function scrubEmployeePayRate(node: Record<string, unknown>): void {
	const isRow = 'id' in node;
	if (!isRow) {
		return;
	}
	for (const key of EMPLOYEE_PAY_RATE_KEYS) {
		delete node[key];
	}
}
