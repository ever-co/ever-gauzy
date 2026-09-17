import { BadRequestException } from '@nestjs/common';
import { IConnection, IPageInfo, IPageInput } from './graphql.types';

/**
 * Paging the connection root fields.
 *
 * Two pagination styles meet here and only one of them is answered at a time. The cursor fields of
 * `PageInput` are what the schema documents, and the platform's own paginated read is page-based, so
 * a cursor in this domain is the offset it resumes from, encoded so that a client treats it as
 * opaque. That is stated rather than hidden: a cursor this domain mints resumes on this domain's
 * connections, and a client that needs a cursor stable against concurrent inserts uses the ordering
 * it asked for to decide what to do about a row it has already seen.
 *
 * The two styles are mutually exclusive on purpose — a request that states both is refused instead of
 * silently preferring one, because they walk differently and neither is a superset of the other.
 */

/** Rows a connection returns when the caller states no page size. */
const DEFAULT_LIMIT = 20;

/** Rows a connection returns at most, so that one query cannot pull a whole price matrix. */
const MAX_LIMIT = 200;

/** The offset a cursor resumes from. */
export interface IWindow {
	/** Rows to return. */
	take: number;
	/** Rows to skip. */
	offset: number;
}

/**
 * @param page The cursor window, when one was asked for.
 * @param limit The page size, when one was asked for.
 * @param offset The offset, when one was asked for.
 * @returns The window to read.
 * @throws BadRequestException when both styles are stated in one request.
 */
export function readWindow(page?: IPageInput, limit?: number, offset?: number): IWindow {
	if (page && (limit !== undefined || offset !== undefined)) {
		throw new BadRequestException(
			'PRICE_PAGINATION_CONFLICT: state either a cursor window (`page`) or a page window (`limit`/`offset`), not both.'
		);
	}

	if (page) {
		const take = clamp(page.first ?? page.last ?? DEFAULT_LIMIT);

		if (page.after) {
			return { take, offset: decodeCursor(page.after) };
		}

		if (page.before) {
			return { take, offset: Math.max(0, decodeCursor(page.before) - take) };
		}

		return { take, offset: 0 };
	}

	return { take: clamp(limit ?? DEFAULT_LIMIT), offset: Math.max(0, offset ?? 0) };
}

/**
 * Reads one page through a service's paginated read and wraps it as a connection.
 *
 * @param page The cursor window, when one was asked for.
 * @param limit The page size, when one was asked for.
 * @param offset The offset, when one was asked for.
 * @param read The paginated read, which receives the page-based window the platform's services take.
 * @returns The page, its total and its boundary.
 */
export async function readConnection<T>(
	page: IPageInput | undefined,
	limit: number | undefined,
	offset: number | undefined,
	read: (window: { take: number; skip: number }) => Promise<{ items: T[]; total: number }>
): Promise<IConnection<T>> {
	const window = readWindow(page, limit, offset);
	// The platform's paginated read takes a one-based page number and multiplies it by the page size,
	// so an offset that is not a multiple of the limit is rounded down to the page boundary. The
	// boundary the response reports is the one that was actually read.
	const pageNumber = Math.floor(window.offset / window.take) + 1;
	const effectiveOffset = (pageNumber - 1) * window.take;
	const { items, total } = await read({ take: window.take, skip: pageNumber });

	return { items, total, pageInfo: buildPageInfo(total, window.take, effectiveOffset, items.length) };
}

/**
 * @param total Rows the whole result holds.
 * @param take Rows this page asked for.
 * @param offset Rows this page skipped.
 * @param returned Rows this page actually holds, when it is known.
 * @returns The boundary of the page.
 */
export function buildPageInfo(total: number, take: number, offset: number, returned?: number): IPageInfo {
	const read = offset + (returned ?? take);

	return {
		hasNextPage: read < total,
		hasPreviousPage: offset > 0,
		startCursor: returned === 0 ? undefined : encodeCursor(offset),
		endCursor: returned === 0 ? undefined : encodeCursor(read)
	};
}

/**
 * @param offset The offset a client may resume from.
 * @returns The opaque cursor.
 */
export function encodeCursor(offset: number): string {
	return Buffer.from(`price-offset:${offset}`, 'utf8').toString('base64');
}

/**
 * @param cursor A cursor this domain minted.
 * @returns The offset it resumes from.
 * @throws BadRequestException when the value is not a cursor this domain minted, so a malformed
 * cursor is refused rather than silently read as position zero.
 */
export function decodeCursor(cursor: string): number {
	const decoded = Buffer.from(cursor, 'base64').toString('utf8');
	const match = /^price-offset:(\d+)$/.exec(decoded);

	if (!match) {
		throw new BadRequestException('PRICE_PAGINATION_CURSOR_INVALID: the cursor is not one this endpoint issued.');
	}

	return Number(match[1]);
}

/**
 * @param value A requested page size.
 * @returns The page size to read, bounded so that one query cannot pull an unbounded number of rows.
 */
function clamp(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return DEFAULT_LIMIT;
	}

	return Math.min(Math.floor(value), MAX_LIMIT);
}
