import { IPagination } from '@gauzy/contracts';
import {
	DEFAULT_CONNECTION_PAGE_SIZE,
	GraphqlConnection,
	IConnectionPageSelection,
	MAX_CONNECTION_PAGE_SIZE,
	connectionFromOffsetPage,
	decodeOffsetCursor,
	encodeOffsetCursor,
	resolveConnectionWindow
} from '@gauzy/core';

/**
 * This package's connection helpers, which are the kernel's.
 *
 * The module used to carry its own copy of the offset window, the cursor codec and the page-to-connection
 * mapping — as five other packages did, all of them the same arithmetic with a name or two changed. A
 * change to the page cap, the default page size or the cursor encoding therefore had to be made in every
 * copy, and the one that was forgotten was the one that drifted. The kernel's `graphql-connection` module
 * owns all of it now, and this file re-exports it under the names this package's call sites already use,
 * so the consolidation changed no call site.
 */

/** The connection a list field answers with, in the shape the SDL declares. */
export type IConnection<T> = GraphqlConnection<T>;

/** The page a caller may state, in either of the protocol's two spellings. */
export type IPageSelection = IConnectionPageSelection;

/** The page size used when a caller states none. */
export const DEFAULT_PAGE_SIZE = DEFAULT_CONNECTION_PAGE_SIZE;

/** The largest page a caller may ask for. */
export const MAX_PAGE_SIZE = MAX_CONNECTION_PAGE_SIZE;

/**
 * @param selection The requested page.
 * @returns The offset the page starts at and how many rows it holds.
 * @throws Error when a caller mixes forward and backward pagination, which has no defined meaning.
 */
export const resolvePageWindow = resolveConnectionWindow;

/**
 * @param cursor The cursor a caller handed back.
 * @returns The offset it carries; zero when there is none or when it is unreadable.
 */
export const decodeCursor = decodeOffsetCursor;

/**
 * @param offset The offset a page starts at.
 * @returns The cursor that resumes at it.
 */
export const encodeCursor = encodeOffsetCursor;

/**
 * @param page The listing the service returned.
 * @param skip The offset the page started at.
 * @returns The connection a GraphQL field answers with.
 */
export function buildConnection<T>(page: IPagination<T>, skip: number): IConnection<T> {
	return connectionFromOffsetPage<T>(page, skip);
}

/**
 * @param id A row's identity, which the offset scheme does not use.
 * @param offset The row's offset in the listing.
 * @returns The cursor that points at the row.
 */
export function cursorFor(id: string | undefined, offset: number): string {
	return encodeOffsetCursor(offset);
}
