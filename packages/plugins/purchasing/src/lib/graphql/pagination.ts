import { IPagination } from '@gauzy/contracts';

/**
 * Cursor pagination for the purchasing domain's connection fields.
 *
 * A cursor here is an opaque string carrying the offset it resumes at. It is opaque on purpose: a
 * client stores it and hands it back, and the codec can change without breaking one. The page size
 * comes from `first` or `last`, and `hasNextPage` is computed from the total the listing already
 * counted, so a client never has to probe for the end of a list.
 *
 * State `first` and `last` together is refused rather than resolved by preferring one: a cursor walk
 * forwards and a cursor walk backwards are two different questions, and answering the wrong one
 * silently is worse than refusing.
 */

/** A page of nodes with the boundary information a connection carries. */
export interface IConnection<T> {
	edges: Array<{ cursor: string; node: T }>;
	nodes: T[];
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor: string | null;
		endCursor: string | null;
	};
	total: number;
}

/** A page selection, as the GraphQL `PageInput` shapes it. */
export interface IPageSelection {
	first?: number;
	after?: string;
	last?: number;
	before?: string;
}

/** The page size used when a caller states none. */
export const DEFAULT_PAGE_SIZE = 25;

/** The largest page a caller may ask for. */
export const MAX_PAGE_SIZE = 200;

/**
 * @param selection The requested page.
 * @returns The offset the page starts at and how many rows it holds.
 * @throws Error when a caller mixes forward and backward pagination, which has no defined meaning.
 */
export function resolvePageWindow(selection?: IPageSelection): { skip: number; take: number } {
	if (selection?.first !== undefined && selection?.last !== undefined) {
		throw new Error('PAGINATION_DIRECTION_CONFLICT: state first or last, not both.');
	}

	const requested = selection?.first ?? selection?.last ?? DEFAULT_PAGE_SIZE;
	const take = Math.min(Math.max(Math.trunc(requested) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
	const cursor = selection?.first !== undefined ? selection?.after : selection?.before;

	return { skip: Math.max(decodeCursor(cursor), 0), take };
}

/**
 * @param cursor The cursor a caller handed back.
 * @returns The offset it carries; zero when there is none or when it is unreadable.
 */
export function decodeCursor(cursor?: string): number {
	if (!cursor) {
		return 0;
	}

	try {
		const offset = Number.parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);

		return Number.isFinite(offset) && offset >= 0 ? offset : 0;
	} catch (error) {
		return 0;
	}
}

/**
 * @param offset The offset a page starts at.
 * @returns The cursor that resumes at it.
 */
export function encodeCursor(offset: number): string {
	return Buffer.from(String(Math.max(offset, 0)), 'utf8').toString('base64');
}

/**
 * @param page The listing the service returned.
 * @param skip The offset the page started at.
 * @returns The connection a GraphQL field answers with.
 */
export function buildConnection<T>(page: IPagination<T>, skip: number): IConnection<T> {
	const nodes = page?.items ?? [];
	const total = page?.total ?? nodes.length;
	const start = skip;
	const end = skip + nodes.length;

	return {
		edges: nodes.map((node, index) => ({ cursor: encodeCursor(start + index), node })),
		nodes,
		pageInfo: {
			hasNextPage: end < total,
			hasPreviousPage: start > 0,
			startCursor: nodes.length ? encodeCursor(start) : null,
			endCursor: nodes.length ? encodeCursor(end) : null
		},
		total
	};
}
