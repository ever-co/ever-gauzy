import { HttpException } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';

/**
 * The shapes every resolver in this package shares.
 *
 * The schema is schema-first, so a resolver returns plain objects and the SDL decides what a client
 * sees. What the resolvers do need is a common answer to three questions, and each of them is
 * answered once here rather than in seven files:
 *
 * 1. **How a page of rows becomes a connection.** The platform's read path answers with
 *    `{ items, total }`; the schema promises `items`, `edges`, `total` and `pageInfo`, where only the
 *    first two are the same fact in two shapes. The cursor is derived from the row itself, so an edge
 *    and an item can never disagree about which row they describe.
 * 2. **How a mutation answers.** Every mutation answers with a payload carrying the resource, the
 *    durable operation when there is one, and `userErrors`. A business rejection — a refund above
 *    what was captured, a session that already settled — is a **successful operation with something
 *    to report**, not a transport error: the caller can act on it, and a client that branches on
 *    `userErrors` first then reads the resource never has to parse a message.
 * 3. **Which failures are business rejections.** A `BadRequestException` or a `NotFoundException` is
 *    a refusal the caller can correct, so it becomes a `userError` carrying the platform's own code.
 *    Anything else is a defect and is rethrown, because an internal failure is not something a client
 *    should be told to retry differently.
 */

/**
 * The boundary of a page, in the shape the kernel's shared `PageInfo` type declares.
 */
export interface IPageInfo {
	readonly hasNextPage: boolean;
	readonly hasPreviousPage: boolean;
	readonly startCursor?: string | null;
	readonly endCursor?: string | null;
}

/**
 * One row of a connection, with the cursor that addresses it.
 */
export interface IEdge<T> {
	readonly cursor: string;
	readonly node: T;
}

/**
 * A page of rows, in the shape every `*Connection` type in the SDL promises.
 */
export interface IConnection<T> {
	readonly items: T[];
	readonly edges: IEdge<T>[];
	readonly total: number;
	readonly pageInfo: IPageInfo | null;
}

/**
 * An expected, caller-correctable outcome of a mutation, in the shape the kernel's `UserError` type
 * declares.
 */
export interface IUserError {
	readonly code: string;
	readonly message: string;
	readonly path?: string[];
	readonly details?: Record<string, unknown>;
}

/**
 * What every mutation answers with.
 */
export interface IMutationPayload<T> {
	/** The aggregate the mutation acted on, absent when it failed outright. */
	readonly resource?: T;
	/** The durable operation the mutation started or continued, when it started one. */
	readonly operation?: unknown;
	/** Never null: empty when there is nothing to report. */
	readonly userErrors: IUserError[];
}

/**
 * Maps a page of rows onto a connection.
 *
 * @param page The page the service returned.
 * @param cursorOf A function deriving a row's cursor, usually its identifier.
 * @returns The connection the SDL promises.
 */
export function toConnection<T>(page: IPagination<T>, cursorOf: (row: T) => string): IConnection<T> {
	const items: T[] = (page?.items ?? []) as T[];
	const edges: IEdge<T>[] = items.map((row) => ({ cursor: cursorOf(row), node: row }));

	return {
		items,
		edges,
		total: page?.total ?? items.length,
		pageInfo: page
			? {
					hasNextPage: items.length < (page.total ?? items.length),
					hasPreviousPage: false,
					startCursor: edges.length ? edges[0].cursor : null,
					endCursor: edges.length ? edges[edges.length - 1].cursor : null
			  }
			: null
	};
}

/**
 * Wraps a resource in a successful mutation payload.
 *
 * @param resource The resource the mutation produced.
 * @returns The payload with nothing to report.
 */
export function payload<T>(resource: T): IMutationPayload<T> {
	return { resource, userErrors: [] };
}

/**
 * Describes a business rejection as a payload rather than as a transport error.
 *
 * The code is the platform's own error code, which is the string a REST caller receives for the same
 * condition, so a client branches on one vocabulary across both surfaces.
 *
 * @param error The refusal the service threw.
 * @returns The payload carrying the refusal in `userErrors`.
 * @throws The original error when it is not a business rejection.
 */
export function rejection<T>(error: unknown): IMutationPayload<T> {
	if (!(error instanceof HttpException)) {
		throw error;
	}

	const response = error.getResponse();
	const described = typeof response === 'string' ? response : ((response as Record<string, unknown>)?.message ?? '');

	return {
		userErrors: [
			{
				code: extractCode(String(described)),
				message: String(described),
				details: typeof response === 'object' ? (response as Record<string, unknown>) : undefined
			}
		]
	};
}

/**
 * Reads the platform error code out of a message.
 *
 * The services report a documented condition by its code — `PAYMENT_OVER_CAPTURE`,
 * `REFUND_AMOUNT_EXCEEDS_CAPTURED` — optionally followed by the sentence that explains it, so the
 * code is the leading upper-snake token when there is one.
 *
 * @param message The message the service threw with.
 * @returns The code, or `VALIDATION_FAILED` when the message carries none.
 */
export function extractCode(message: string): string {
	const match = /^([A-Z][A-Z0-9_]{2,})/.exec(message.trim());

	return match ? match[1] : 'VALIDATION_FAILED';
}

/**
 * Maps a sort input onto the ordering a repository understands.
 *
 * The SDL names a sort field the way a client thinks about it (`CREATED_AT`) and the entity names the
 * column the way the database stores it (`createdAt`), so the translation is a declared table rather
 * than a guess, and an unknown field falls back to the table's own creation order instead of reaching
 * the query builder as a column that does not exist.
 *
 * @param sort The requested sort, when the caller asked for one.
 * @param fields The declared field table of that connection.
 * @param fallback The field applied when no sort was requested.
 * @returns The ordering to pass to the service.
 */
export function toOrder(
	sort: { field?: string; direction?: string } | undefined,
	fields: Record<string, string>,
	fallback = 'createdAt'
): Record<string, string> {
	const field = sort?.field ? fields[sort.field] ?? fallback : fallback;
	const direction = sort?.direction === 'DESC' ? 'DESC' : 'ASC';

	return { [field]: direction };
}
