/**
 * Byte budgets of the `text` columns an inbound message fills (review F109).
 *
 * MySQL's `text` holds at most 65,535 bytes, and a strict server refuses a longer value. A message whose To or Cc list,
 * References chain or kept headers are longer than that (a large announcement without Bcc) failed to store, and its
 * webhook failed for every retry of the provider. Postgres and SQLite `text` have no such limit, so there the values
 * are stored whole, as before.
 */

/** The most bytes a MySQL `text` column holds. */
export const MYSQL_TEXT_BYTES = 65_535;

const bytesOf = (text: string): number => Buffer.byteLength(text, 'utf8');

/**
 * The JSON text of a list (`null` for nothing), keeping as many entries as fit in `budget` bytes: the first ones
 * (`head`, an address list), or the last ones (`tail`, a References chain, whose newest ids thread a reply).
 * Without a budget the whole list is kept.
 */
export function jsonListWithin(
	list: readonly unknown[] | null | undefined,
	budget: number | null,
	keep: 'head' | 'tail' = 'head'
): string | null {
	if (!Array.isArray(list) || list.length === 0) return null;
	const whole = JSON.stringify(list);
	if (budget === null || bytesOf(whole) <= budget) return whole;
	const slice = (count: number) => (keep === 'head' ? list.slice(0, count) : list.slice(list.length - count));
	// The longest prefix (or suffix) that fits: the JSON grows with every entry, so a binary search finds it.
	let low = 0;
	let high = list.length - 1;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (bytesOf(JSON.stringify(slice(middle))) <= budget) low = middle;
		else high = middle - 1;
	}
	return low > 0 ? JSON.stringify(slice(low)) : null;
}

/**
 * The JSON text of the kept headers within `budget` bytes: the headers named in `always` stay (the hold and the tag
 * the webhook sets), the others are left out from the last one until the rest fits. Without a budget all are kept.
 */
export function jsonHeadersWithin(
	headers: Record<string, string>,
	budget: number | null,
	always: readonly string[] = []
): string | null {
	const entries = Object.entries(headers);
	if (entries.length === 0) return null;
	const whole = JSON.stringify(headers);
	if (budget === null || bytesOf(whole) <= budget) return whole;
	const kept = new Map(entries);
	for (const [name] of [...entries].reverse()) {
		if (always.includes(name)) continue;
		kept.delete(name);
		if (bytesOf(JSON.stringify(Object.fromEntries(kept))) <= budget) break;
	}
	return kept.size > 0 ? JSON.stringify(Object.fromEntries(kept)) : null;
}
