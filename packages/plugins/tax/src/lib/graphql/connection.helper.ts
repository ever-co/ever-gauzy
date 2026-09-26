import { PageInfo, PageInput } from './graphql.types';

/**
 * The shape of one page of a connection.
 */
export interface ConnectionPage<Node> {
	nodes: Node[];
	edges: Array<{ node: Node; cursor: string }>;
	totalCount: number;
	pageInfo: PageInfo;
}

/**
 * Assembles a connection from a page of rows.
 *
 * Every list root field of the platform returns the same envelope, and the cursors are the REST ones:
 * `base64(createdAt|id)`, so a cursor a client obtained over REST resumes the same listing over GraphQL
 * and the reverse. `hasNextPage` is decided by comparing the filtered total with the rows that were
 * returned, which holds for both the cursor form and the offset form because the total is the count of
 * the whole filtered set, not of the page.
 *
 * @param rows The page's rows, in the order they are returned.
 * @param totalCount The count of the filtered set.
 * @param page The cursor page that was asked for, when one was.
 * @param project Maps a row to the object the schema exposes, when the two differ.
 * @returns The connection.
 */
export function toConnection<Node, Result = Node>(
	rows: Node[],
	totalCount: number,
	page?: PageInput,
	project?: (node: Node) => Result
): ConnectionPage<Result> {
	const records = rows ?? [];
	const nodes = records.map((row) => (project ? project(row) : (row as unknown as Result)));
	const cursors = records.map((row) => encodeCursor(row));

	return {
		nodes,
		edges: nodes.map((node, index) => ({ node, cursor: cursors[index] })),
		totalCount,
		pageInfo: {
			hasNextPage: totalCount > records.length,
			hasPreviousPage: !!page?.after || !!page?.before,
			startCursor: cursors.length ? cursors[0] : undefined,
			endCursor: cursors.length ? cursors[cursors.length - 1] : undefined
		}
	};
}

/**
 * @param row A row of a connection.
 * @returns The opaque cursor that resumes a listing at that row.
 */
export function encodeCursor(row: unknown): string {
	const { id, createdAt } = (row ?? {}) as { id?: unknown; createdAt?: unknown };
	const stamp = createdAt ? new Date(createdAt as string).toISOString() : '';

	return Buffer.from(`${stamp}|${id ?? ''}`).toString('base64');
}
