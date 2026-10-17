import { BadRequestException } from '@nestjs/common';
import { parseToBoolean } from '@gauzy/utils';

/**
 * The find options one payment list route hands its service.
 *
 * `where` is always present — the criterion the query string stated, which the service then merges
 * with the caller's tenancy scope — and every other member is present only when the query stated it,
 * so an absent member is never forwarded as an explicit `undefined`.
 *
 * A type rather than an interface, so that it is assignable to the `Record<string, unknown>` the
 * services' list methods take: an interface carries no implicit index signature.
 */
export type PaymentListOptions = {
	/** The criterion the query stated: its flat members and its `where[...]` members together. */
	where: Record<string, unknown>;
	/** How many rows to answer with, when the query stated it. */
	take?: number;
	/** How many rows to pass over before the first one answered — a row offset, never a page number. */
	skip?: number;
	/** Present, and `true`, only when the query asked for retired rows too. */
	withDeleted?: true;
	/** The relations to load, as the query stated them. */
	relations?: unknown;
	/** The order to answer in, as the query stated it. */
	order?: unknown;
	/** The columns to select, as the query stated them. */
	select?: unknown;
};

/**
 * The largest page one list route answers with — the bound `BaseQueryDTO` declares for `take`.
 */
const MAX_TAKE = 100;

/**
 * Turns the raw query string of a payment list route into the find options its service reads.
 *
 * The eight list routes of this package bind their query to `BaseQueryDTO` and mount no validation
 * pipe, so what a handler receives is the parser's raw object — every value a string — and the DTO's
 * own transforms never run. Handing that object to the service whole, which is what the routes did,
 * went wrong in three ways at once, and this function is the one place all three are answered:
 *
 * 1. **`withDeleted` is read as a boolean, not as a string.** `?withDeleted=false` arrived as the
 *    string `'false'`, which is truthy, and both ORMs lift the soft-delete filter for a truthy value —
 *    TypeORM's `findAndCount` and the kernel's MikroORM option parser alike — so the one request that
 *    asked for live rows only was answered with the retired ones as well. It is parsed with the
 *    platform's own boolean reader, the one the DTO's transform names, and forwarded only when true.
 * 2. **A flat filter is a criterion again.** Before the routes spread the DTO they nested it under
 *    `where`, so `GET /refund-lines?refundId=R1` answered R1's lines only. Spread whole, `refundId` became
 *    a top-level find option that neither ORM reads, and the route answered every line of the
 *    organization with nothing to say the filter had been dropped. The members that are find options
 *    are taken out by name; everything else is the criterion, merged with the bracketed `where[...]`
 *    spelling, which wins where both name the same column because it is the explicit one.
 * 3. **`skip` means one thing.** It is a row offset — the meaning `BaseQueryDTO` documents ("Offset …
 *    where from entities should be taken") and the one the GraphQL connections of the same services
 *    hand over as their `offset` — and it is forwarded as a number, so the kernel's `findAll` reads it
 *    the same way on TypeORM and on MikroORM. `take` is bounded as the DTO bounds it. A value that is
 *    not a whole number in range is refused with `400` rather than guessed at, because a page that was
 *    silently read from somewhere else is the failure this function exists to end.
 *
 * The literal strings `'true'` and `'false'` in the criterion are read as booleans, because a query
 * string cannot carry any other kind of value and a boolean column compared with the word `'true'`
 * matches nothing on SQLite, which stores the column as `1`, and the `false` rows on MySQL, where the
 * word casts to `0`. Every other value is forwarded as the client wrote it, exactly as the routes
 * forwarded it when they honoured flat filters.
 *
 * @param query The query string as the route received it.
 * @returns The find options to hand the service.
 * @throws BadRequestException when `take` or `skip` is not a whole number in range, or when `where` is
 * not a map of columns.
 */
export function toPaymentListOptions(query?: object | null): PaymentListOptions {
	const { take, skip, withDeleted, relations, order, select, where, ...flat } = (query ?? {}) as Record<
		string,
		unknown
	>;

	// A `where` that is not a map of columns — a JSON string, an array of alternatives — is refused rather
	// than dropped: dropped, it would answer the whole organization as if it had been honoured.
	if (where !== undefined && (!where || typeof where !== 'object' || Array.isArray(where))) {
		throw new BadRequestException('The where filter must be stated column by column, as where[column]=value.');
	}

	return {
		where: readCriterion({ ...flat, ...((where as Record<string, unknown>) ?? {}) }),
		...(take !== undefined && take !== '' ? { take: readWholeNumber('take', take, MAX_TAKE) } : {}),
		...(skip !== undefined && skip !== '' ? { skip: readWholeNumber('skip', skip) } : {}),
		...(parseToBoolean(withDeleted) ? { withDeleted: true as const } : {}),
		...(relations !== undefined ? { relations } : {}),
		...(order !== undefined ? { order } : {}),
		...(select !== undefined ? { select } : {})
	};
}

/**
 * The criterion of a list query, with the two boolean words read as booleans.
 *
 * @param criterion The members the query stated as criteria.
 * @returns The same members, `'true'` and `'false'` read as the booleans they stand for.
 */
function readCriterion(criterion: Record<string, unknown>): Record<string, unknown> {
	const read: Record<string, unknown> = {};

	for (const [member, value] of Object.entries(criterion)) {
		read[member] = value === 'true' ? true : value === 'false' ? false : value;
	}

	return read;
}

/**
 * Reads one paging member as a whole, non-negative number.
 *
 * @param member The member being read, named in the refusal.
 * @param value The value as the query stated it.
 * @param max The largest value accepted, when there is one.
 * @returns The value as a number.
 * @throws BadRequestException when the value is not a whole number between zero and `max`.
 */
function readWholeNumber(member: string, value: unknown, max?: number): number {
	const read = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;

	if (!Number.isInteger(read) || read < 0 || (max !== undefined && read > max)) {
		throw new BadRequestException(
			`QUERY_PAGE_LIMIT_EXCEEDED: ${member} must be a whole number from 0${max !== undefined ? ` to ${max}` : ''}.`
		);
	}

	return read;
}
