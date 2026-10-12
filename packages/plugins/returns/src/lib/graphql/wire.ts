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
 * @param value A quantity or amount.
 * @returns It as an exact decimal string, which is what the `Decimal` scalar carries.
 */
export function toDecimalString(value: string | number | null | undefined): string {
	return normalizeQuantity(value);
}
