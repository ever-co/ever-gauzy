/**
 * Calculates the average value of a specified column in an array of objects.
 *
 * @param items - The array of objects containing the column to average.
 * @param column - The key of the column to calculate the average for.
 * @returns The average value of the specified column, or `NaN` if the array is empty or contains invalid values.
 *
 * @example
 * ```typescript
 * const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
 * const result = average(data, 'value');
 * // result: 20
 * ```
 */
export function average<T extends Record<string, any>>(items: T[], column: string): number {
	if (items.length === 0) return NaN;

	const sum = items.reduce((acc, item) => acc + parseFloat(item[column] ?? 0), 0);
	return sum / items.length;
}
