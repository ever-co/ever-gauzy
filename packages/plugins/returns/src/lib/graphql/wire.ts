import { HttpException } from '@nestjs/common';
import { normalizeQuantity } from '../returns.quantity';

/**
 * The wire shapes a resolver answers with.
 *
 * A mutation reports an outcome the caller could have avoided in `userErrors` with the operation
 * succeeding, and only a request that could not have been made correctly becomes a GraphQL error.
 * The code is taken from the exception's own message when the service named a platform code (the
 * convention is a `CODE:` prefix) and derived from the HTTP status otherwise, so a client sees one
 * vocabulary across the two surfaces.
 */

/** One expected, caller-correctable outcome of a mutation. */
export interface IUserError {
	code: string;
	message: string;
	path?: string[];
	details?: unknown;
}

/** The codes the returns domain raises that a client is expected to branch on. */
const KNOWN_CODES = [
	'RETURN_FULFILLMENT_UNAVAILABLE',
	'RETURN_STOCK_LEDGER_UNAVAILABLE',
	'RETURN_REFUND_UNAVAILABLE',
	'RETURN_SHIPPING_UNAVAILABLE',
	'RETURN_REASON_IN_USE',
	'CLAIM_FULFILLMENT_UNAVAILABLE',
	'CLAIM_REFUND_UNAVAILABLE',
	'EXCHANGE_FULFILLMENT_UNAVAILABLE',
	'EXCHANGE_PRICE_UNAVAILABLE',
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
 * The outcome of a hard delete, as a mutation payload carries it.
 *
 * The kernel's `TenantAwareCrudService.delete` checks no existence: a scoped `DELETE` that matched nothing —
 * an identifier of another tenant, a stale one, one already removed — answers `affected: 0` and raises
 * nothing, so a payload built only from "no exception" told the caller a row was removed when none was
 * (handover 2026-09-20 §7.65 item 21), while the REST route's own result said `affected: 0`. A result that
 * states a count is read as both ORMs report it (`affected`); a result that states none — a service whose own
 * `delete` answers the row it acted on instead, or nothing — either acted or raised, and reads as done. A
 * removal that reached nothing is reported as the warehouse plugin reports it: `NOT_FOUND` on the `id`
 * argument, the code a 404 maps to.
 *
 * @param result What the service's removal returned.
 * @param id The identifier the caller named.
 * @returns No outcome when a row was removed, and the `NOT_FOUND` outcome when none was.
 */
export function deleteOutcome(result: unknown, id: string): IUserError[] {
	const affected = (result as { affected?: unknown } | null | undefined)?.affected;

	if (typeof affected !== 'number' || affected > 0) {
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
 * @param value A quantity or amount.
 * @returns It as an exact decimal string, which is what the `Decimal` scalar carries.
 */
export function toDecimalString(value: string | number | null | undefined): string {
	return normalizeQuantity(value);
}
