import { formatEntityTag, parseEntityVersion } from '@gauzy/core';

/**
 * What the child-resource create routes (`POST /cart-lines`, `POST /cart-shipping-methods`) share in their
 * answer: the cart's new version, and the row the request itself produced.
 *
 * Both routes are a write to the CART — they are versioned against it and the cart service re-prices it —
 * but they answer with the child row, which carries no version, so `VersionInterceptor` (which publishes
 * `result.version`) has nothing to publish. The version the next conditional write must state is the
 * cart's, so that is the `ETag` these routes publish, exactly as the nested `/carts/:id/...` routes do
 * with the cart in their body.
 */

/** A row the two routes answer with: its identity and the instants that order it. */
interface ICartChildRow {
	id?: string;
	createdAt?: Date | string;
	updatedAt?: Date | string;
	deletedAt?: Date | string | null;
}

/**
 * Publishes the cart's version as the response's `ETag`.
 *
 * @param request The HTTP request, whose response the header is set on.
 * @param cart The cart the service answered with after the write.
 */
export function publishCartVersion(request: any, cart: { version?: unknown } | null | undefined): void {
	const version = parseEntityVersion(cart?.version);
	const response = request?.res;

	if (version === null || !response || typeof response.setHeader !== 'function' || response.headersSent) {
		return;
	}

	response.setHeader('ETag', formatEntityTag(version));
}

/**
 * The newest of a set of rows by one of their instants, or undefined for an empty set.
 *
 * @param rows The candidates.
 * @param by The instant that orders them.
 * @returns The newest row.
 */
export function newestOf<T extends ICartChildRow>(rows: T[], by: 'createdAt' | 'updatedAt'): T | undefined {
	return rows.reduce<T | undefined>(
		(found, row) =>
			!found || new Date(row[by] ?? 0).getTime() >= new Date(found[by] ?? 0).getTime() ? row : found,
		undefined
	);
}

/**
 * The ids of the rows a cart held before a write, read before the write so the row the write produced can
 * be told from one a concurrent request produced.
 *
 * @param rows The rows read before the write.
 * @returns Their ids.
 */
export function idsOf(rows: ICartChildRow[] | undefined): Set<string> {
	return new Set((rows ?? []).map((row) => row.id).filter((id): id is string => typeof id === 'string'));
}
