/**
 * Sums two numbers, handling numeric strings, null, undefined, and other invalid values gracefully.
 *
 * @param {number | string | null | undefined} a - The first number to sum.
 * @param {number | string | null | undefined} b - The second number to sum.
 * @returns {number} The sum of the two values as a number.
 *
 * @example
 * ```typescript
 * // Using ArraySum directly
 * const result = ArraySum("3.5", 4.5);
 * // result: 8
 *
 * // Using ArraySum in a reduce function to sum values
 * const values = [{ duration: '3.5' }, { duration: 4.5 }, { duration: '2' }];
 * const durations = values.map(item => item.duration);
 * const totalDuration = durations.reduce(ArraySum, 0);
 * // totalDuration: 10
 * ```
 */
export const ArraySum = (
	a: number | string | null | undefined = 0,
	b: number | string | null | undefined = 0
): number => {
	// Convert valid number strings to floats; otherwise, default to 0
	const numA = typeof a === 'number' ? a : typeof a === 'string' && !isNaN(parseFloat(a)) ? parseFloat(a) : 0;
	const numB = typeof b === 'number' ? b : typeof b === 'string' && !isNaN(parseFloat(b)) ? parseFloat(b) : 0;

	return numA + numB;
};
