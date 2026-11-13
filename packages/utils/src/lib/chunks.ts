/**
 * Splits an array into multiple, smaller arrays (chunks) of a specified size.
 *
 * @param items - The array to split into chunks.
 * @param size - The number of elements per chunk.
 * @returns An array of smaller arrays, each containing elements up to the given size.
 *
 * @throws Will throw an error if `size` is not a positive integer.
 *
 * @example
 * ```typescript
 * const result = chunks([1, 2, 3, 4, 5, 6], 2);
 * // result: [[1, 2], [3, 4], [5, 6]]
 * ```
 */
export function chunks<T>(items: T[], size: number): T[][] {
	// `size <= 0` alone lets `NaN` through (every comparison with it is false) and accepts fractions,
	// where `slice` truncates its arguments: `chunks([1, 2, 3], 0.5)` produced empty and repeated
	// chunks. `Infinity` is kept as "one chunk", the result it always had.
	const isWholeNumber = Number.isInteger(size) || size === Infinity;
	if (!isWholeNumber || size <= 0) {
		throw new Error('Size must be a positive integer.');
	}

	const result: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		result.push(items.slice(i, i + size));
	}
	return result;
}
