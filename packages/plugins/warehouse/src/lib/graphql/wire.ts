import { HttpException } from '@nestjs/common';
import { normalizeQuantity } from '../warehouse.quantity';

/**
 * The wire shapes a resolver answers with.
 *
 * A mutation reports an outcome the caller could have avoided in `userErrors` while the operation
 * itself succeeds, and only a request that could not have been made correctly becomes a GraphQL error.
 * The code is taken from the exception's own message when the service named a platform code — the
 * convention is a `CODE:` prefix — and derived from the HTTP status otherwise, so a client sees one
 * vocabulary across the two surfaces.
 */

/** One expected, caller-correctable outcome of a mutation. */
export interface IUserError {
	code: string;
	message: string;
	path?: string[];
	details?: unknown;
}

/**
 * The codes this domain raises that a client is expected to branch on.
 *
 * They are listed rather than matched by shape because a code is part of the contract: a client that
 * branches on `MANIFEST_EMPTY` has to keep working when the message around it is reworded.
 */
const KNOWN_CODES = [
	'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE',
	'WAREHOUSE_FULFILLMENT_UNAVAILABLE',
	'WAREHOUSE_NO_PICKING_ZONE',
	'ZONE_HAS_BINS',
	'BIN_HAS_CHILDREN',
	'BIN_HAS_CONTENT',
	'BIN_HIERARCHY_CYCLE',
	'BIN_HIERARCHY_TOO_DEEP',
	'BIN_LOCATION_IMMUTABLE',
	'BIN_LOCATION_MISMATCH',
	'BIN_CODE_IMMUTABLE',
	'PICK_LINE_UNBINNED',
	'PICK_LINE_PENDING',
	'PICK_OVER_QUANTITY',
	'PICK_LIST_HAS_PICKS',
	'PICK_LIST_OPEN',
	'PICK_NOTHING_TO_PICK',
	'WAVE_ILLEGAL_TRANSITION',
	'MANIFEST_ILLEGAL_TRANSITION',
	'MANIFEST_EMPTY',
	'MANIFEST_FULFILLMENT_NOT_SHIPPED',
	'PACK_SLIP_INCOMPLETE',
	'PACK_SLIP_TRACKING_DUPLICATE',
	'PAGINATION_DIRECTION_CONFLICT'
];

/**
 * @param status An HTTP status.
 * @returns The stable code the GraphQL surface reports for it.
 */
function codeForStatus(status: number): string {
	switch (status) {
		case 400:
			return 'BAD_REQUEST';
		case 401:
			return 'UNAUTHENTICATED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 409:
			return 'CONFLICT';
		case 422:
			return 'UNPROCESSABLE_ENTITY';
		default:
			return 'INTERNAL_ERROR';
	}
}

/**
 * @param error The error a service threw.
 * @returns The outcome a mutation payload carries.
 */
export function toUserError(error: unknown): IUserError {
	const message = error instanceof Error ? error.message : String(error);
	const named = KNOWN_CODES.find((code) => message.includes(code));
	const prefixed = /^([A-Z][A-Z0-9_]{3,}):/.exec(message)?.[1];
	const code =
		named ?? prefixed ?? (error instanceof HttpException ? codeForStatus(error.getStatus()) : 'INTERNAL_ERROR');

	return { code, message, path: [], details: null };
}

/**
 * What a destructive delete answers, from the result its removal reported.
 *
 * `TenantAwareCrudService.delete` checks no existence: a scoped `DELETE` that matched nothing — an
 * identifier of another tenant, a stale one, one already removed — reports `affected: 0` and raises
 * nothing, so a payload built only from "no exception" told the caller a row was removed when none was.
 * The count is read as both ORMs report it (`affected` on TypeORM's `DeleteResult`, the same member on the
 * result the MikroORM branch builds), and a removal that reached nothing is reported as the outcome the
 * REST surface gives the same identifier on a read: `NOT_FOUND`, the code `codeForStatus` derives for a
 * 404, on the `id` argument it concerns. It is the order plugin's rule for its own deletes —
 * `deleted: Number(result?.affected ?? 0) > 0` — carried in this plugin's payload vocabulary.
 *
 * @param result What the service's removal returned.
 * @param id The identifier the caller named.
 * @returns No outcome when a row was removed, and the `NOT_FOUND` outcome when none was.
 */
export function deleteOutcome(result: unknown, id: string): IUserError[] {
	const affected = Number((result as { affected?: unknown } | null | undefined)?.affected ?? 0);

	if (affected > 0) {
		return [];
	}

	return [
		{
			code: 'NOT_FOUND',
			message: `NOT_FOUND: no record with id ${id} was found to delete.`,
			path: ['id'],
			details: { id }
		}
	];
}

/**
 * @param value A quantity or a weight.
 * @returns It as an exact decimal string, which is what the `Decimal` scalar carries.
 */
export function toDecimalString(value: string | number | null | undefined): string {
	return normalizeQuantity(value);
}
