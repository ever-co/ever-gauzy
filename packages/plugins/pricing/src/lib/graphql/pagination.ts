import {
	GraphqlConnection,
	connectionFromOffsetPage,
	decodeOffsetCursor,
	encodeOffsetCursor,
	resolveConnectionWindow
} from '@gauzy/core';

/**
 * This package's connection helpers, which are the kernel's.
 *
 * The module used to carry its own pagination: a window resolver, a page-to-connection mapper, a boundary
 * builder and a cursor codec under a `price-offset:` prefix of its own. All of it was the kernel's
 * arithmetic with a different name — and in two places with different behaviour: its cursors were read
 * inclusively, so a walk re-answered one row per page, and a cursor could name any offset while the read it
 * fed could only start on a page boundary, so a cursor inside a page answered the page it was in. The
 * boundary builder is gone with it, because `connectionFromOffsetPage` computes the boundary from the page
 * it was handed and a second implementation of that is a second answer waiting to differ.
 */

/**
 * @param page The requested page.
 * @param limit The page size, when it is stated as a limit rather than as `first`.
 * @param offset The offset, when it is stated as an offset rather than as a cursor.
 * @returns The offset the page starts at and how many rows it holds.
 * @throws BadRequestException when a caller states both styles, both directions, an anchorless backward walk,
 * or a cursor this platform did not mint.
 */
export function readWindow(
	page?: Parameters<typeof resolveConnectionWindow>[0],
	limit?: number,
	offset?: number
): { skip: number; take: number } {
	return resolveConnectionWindow({ ...(page ?? {}), limit, offset });
}

/**
 * The order a store-paged read states, as the platform's find options spell it: column to direction, in
 * the order the keys are compared.
 */
export type ConnectionReadOrder = Record<string, 'ASC' | 'DESC'>;

/**
 * Closes an order with the row's identity, so no two rows compare equal under it.
 *
 * **A cursor here is a position, so the order has to put every row in exactly one.** An offset cursor
 * names "the row at offset 19 of this order", and the next page is `OFFSET 20` of the same order. When the
 * order has ties — every list sorted by `status`, by `priority`, by a `createdAt` two rows share, or by
 * nothing at all — the store is free to break them differently on each read: the planner picks another plan
 * as the offset grows, and on Postgres an `UPDATE` writes a new tuple at the end of the heap. Either way the
 * second page is cut from a different arrangement than the first, and the walk repeats one row and never
 * shows another, with nothing in the connection able to notice. The primary key is unique, so appending it
 * leaves the order the caller asked for intact and makes the arrangement one the store cannot vary.
 *
 * The identity is compared in the direction of the order's leading key, so a list read newest-first breaks
 * its ties newest-first too; an order that already names `id` is total already and is returned as it is.
 *
 * @param order The order the caller or the resource asked for.
 * @returns The same order, closed by `id`.
 */
export function totalOrder(order: ConnectionReadOrder): ConnectionReadOrder {
	if (Object.prototype.hasOwnProperty.call(order, 'id')) {
		return { ...order };
	}

	const [leading] = Object.values(order);

	return { ...order, id: leading ?? 'ASC' };
}

/**
 * Reads one page through a service's paginated read and wraps it as a connection.
 *
 * The read receives a **row offset**, which is what this platform's `findAll` takes — on both ORMs: the
 * kernel hands TypeORM `skip` as it is and hands MikroORM the same number as its `offset`. The page used to
 * be translated into a page number here — which is what `paginate` takes — and that translation is what
 * rounded a cursor that did not sit on a page boundary down to the page it was in, answering rows the caller
 * had already been given.
 *
 * **The order is a parameter, not an option.** An offset is only a position within an order, so a read
 * that could be issued without one could publish cursors that name nothing; the read is handed the order
 * {@link totalOrder} closed rather than the one it was given, so a sort the caller chose over a column with
 * ties still pages without repeating or skipping a row.
 *
 * @param page The cursor window, when one was asked for.
 * @param limit The page size, when one was asked for.
 * @param offset The offset, when one was asked for.
 * @param order The order the page is cut from, before it is closed by the row's identity.
 * @param read The paginated read, which receives the row window and the total order to read it in.
 * @returns The page, its total and its boundary.
 */
export async function readConnection<T>(
	page: Parameters<typeof resolveConnectionWindow>[0] | undefined,
	limit: number | undefined,
	offset: number | undefined,
	order: ConnectionReadOrder,
	read: (window: { take: number; skip: number; order: ConnectionReadOrder }) => Promise<{ items: T[]; total: number }>
): Promise<GraphqlConnection<T>> {
	const window = readWindow(page, limit, offset);
	const listing = await read({ take: window.take, skip: window.skip, order: totalOrder(order) });

	return connectionFromOffsetPage<T>(listing, window.skip);
}

/**
 * @param offset The offset of the row a cursor addresses.
 * @returns The opaque cursor.
 */
export const encodeCursor = encodeOffsetCursor;

/**
 * @param cursor A cursor this platform minted.
 * @returns The offset of the row it addresses; zero when it is unreadable.
 */
export const decodeCursor = decodeOffsetCursor;
