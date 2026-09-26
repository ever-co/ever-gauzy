import { HttpException } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { connectionFromOffsetPage } from '@gauzy/core';

/**
 * The shapes every resolver in this package shares.
 *
 * The schema is schema-first, so a resolver returns plain objects and the SDL decides what a client
 * sees. What the resolvers do need is a common answer to three questions, and each of them is
 * answered once here rather than in seven files:
 *
 * 1. **How a page of rows becomes a connection.** The platform's read path answers with
 *    `{ items, total }`; the schema promises `nodes`, `edges`, `totalCount` and `pageInfo`, where the
 *    count is the same fact under the name every other connection in the platform gives it. The cursor is
 *    derived from the row itself, so an edge and a node can never disagree about which row they describe.
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
 *
 * The count is `totalCount` — what REST's separate `/count` route answers, and the name every other
 * connection in the platform declares — and `pageInfo` is never absent: a boundary that can be null makes
 * every cursor walk defend against a state the schema cannot produce.
 */
export interface IConnection<T> {
	readonly nodes: readonly T[];
	readonly edges: readonly IEdge<T>[];
	readonly totalCount: number;
	readonly pageInfo: IPageInfo;
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
 * A mutation payload whose resource member is named after the resource.
 *
 * The SDL names the member a client selects — `paymentSession`, `refund`, `refundReason` — rather than
 * a generic `resource`, because a client reads the type's own member and never a bag. A payload alias
 * therefore states both halves: the shape every mutation in this package answers with, and the member
 * the schema actually declares. The generic member stays declared and stays empty, so a resolver that
 * answers through `rejection` and one that answers with a resource are the same type to a caller.
 *
 * @template T The resource the mutation acted on.
 * @template K The member name the SDL gives that resource.
 */
export type IResourcePayload<T, K extends string> = IMutationPayload<T> & {
	readonly [member in K]: T | null;
};

/**
 * Maps a page of rows onto a connection.
 *
 * The mapping itself is the kernel's, because this package's copy of it was one of three spellings of the
 * same arithmetic across the branch — and the kernel offers two of them, which is the distinction this
 * function got wrong.
 *
 * `connectionFromPage` addresses each row by whatever identifies it, which is right for a resource with a
 * natural key. Every list field in this package reads a **store-paged** window instead
 * (`findAll({ skip, take })`), and a store-paged read cannot resume from a value — so the kernel's
 * `connectionFromOffsetPage` addresses the page by the offset it started at, which is exactly what the
 * `after` cursor of `resolveConnectionWindow` reads back. Publishing row-id cursors here while accepting
 * offset cursors meant `after: pageInfo.endCursor` — the walk every client library performs — named a
 * cursor this field's own window refuses, and the walk was impossible without the client guessing.
 *
 * @param page The page the service returned.
 * @param skip The offset the page started at, which is what makes its boundary true.
 * @returns The connection the SDL promises.
 */
export function toConnection<T>(page: IPagination<T>, skip = 0): IConnection<T> {
	return connectionFromOffsetPage<T>(page, skip);
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
