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
 * Reads one page through a service's paginated read and wraps it as a connection.
 *
 * The read receives a **row offset**, which is what this platform's `findAll` takes. The page used to be
 * translated into a page number here — which is what `paginate` takes — and that translation is what rounded
 * a cursor that did not sit on a page boundary down to the page it was in, answering rows the caller had
 * already been given.
 *
 * @param page The cursor window, when one was asked for.
 * @param limit The page size, when one was asked for.
 * @param offset The offset, when one was asked for.
 * @param read The paginated read, which receives the row window the platform's services take.
 * @returns The page, its total and its boundary.
 */
export async function readConnection<T>(
	page: Parameters<typeof resolveConnectionWindow>[0] | undefined,
	limit: number | undefined,
	offset: number | undefined,
	read: (window: { take: number; skip: number }) => Promise<{ items: T[]; total: number }>
): Promise<GraphqlConnection<T>> {
	const window = readWindow(page, limit, offset);
	const listing = await read({ take: window.take, skip: window.skip });

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
