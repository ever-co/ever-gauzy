import { HttpException } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { IGoodsReceipt } from '../purchasing.types';
import { normalizeQuantity } from '../purchasing.quantity';

/**
 * The wire shapes a resolver answers with.
 *
 * A rejection the caller could have avoided is reported in `userErrors` with the operation
 * succeeding, and only a request that could not have been made correctly becomes a GraphQL error. The
 * code is taken from the exception's own message when the service named a platform code — the
 * convention is a `CODE:` prefix — and derived from the HTTP status otherwise, so a client branches
 * on one vocabulary across both surfaces.
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
 * Listed rather than pattern-matched so that a message that merely looks like a code cannot become
 * one: the vocabulary a client branches on has to be a closed set.
 */
const KNOWN_CODES = [
	'PURCHASE_ORDER_NOT_FOUND',
	'PURCHASE_ORDER_NOT_SENT',
	'PURCHASE_ORDER_INVALID_STATE',
	'PURCHASE_ORDER_ALREADY_RECEIVED',
	'PURCHASE_ORDER_NOT_APPROVED',
	'PURCHASE_ORDER_RECEIPT_QUANTITY_EXCEEDS_ORDERED',
	'PURCHASE_ORDER_VENDOR_NOT_FOUND',
	'PURCHASE_ORDER_VENDOR_INACTIVE',
	'PURCHASE_ORDER_VENDOR_REQUIRED',
	'PURCHASE_ORDER_WAREHOUSE_REQUIRED',
	'PURCHASE_ORDER_CURRENCY_REQUIRED',
	'PURCHASE_ORDER_VERSION_CONFLICT',
	'PURCHASE_ORDER_SEQUENCE_MISSING',
	'PURCHASE_ORDER_LINE_NOT_FOUND',
	'PURCHASE_ORDER_LINE_VARIANT_MISSING',
	'PURCHASE_ORDER_LINE_COST_REQUIRED',
	'GOODS_RECEIPT_NOT_FOUND',
	'GOODS_RECEIPT_SEQUENCE_MISSING',
	'RECEIPT_WAREHOUSE_REQUIRED',
	'RECEIPT_WAREHOUSE_MISMATCH',
	'RECEIPT_ORDER_MISMATCH',
	'PURCHASING_INVENTORY_UNAVAILABLE',
	'VENDOR_TERM_NOT_FOUND',
	'VENDOR_TERM_OVERLAP',
	'VENDOR_TERM_VENDOR_REQUIRED',
	'VENDOR_TERM_VARIANT_REQUIRED',
	'VENDOR_TERM_PRICE_REQUIRED',
	'VENDOR_TERM_PACK_SIZE_REQUIRED',
	'VENDOR_TERM_WINDOW_INVALID',
	'VENDOR_TERM_CURRENCY_REQUIRED',
	'VENDOR_TERM_ORGANIZATION_REQUIRED',
	'VENDOR_TERM_CONTEXT_INCOMPLETE',
	'PRICE_EXCHANGE_RATE_MISSING',
	'RECEIPT_OVER_TOLERANCE',
	'PURCHASE_LINE_OVERBILLED',
	'PURCHASE_BILL_VENDOR_MISMATCH',
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
 * @param value A quantity.
 * @returns It as an exact decimal string at the storage scale, which is what the `Decimal` scalar
 * carries.
 */
export function toDecimalString(value: string | number | null | undefined): string {
	return normalizeQuantity(value);
}

/**
 * @param receipt The receipt as it stands after the operation, which carries what the operation did
 * to the ledger and to the order it is against.
 * @returns The members the goods-receipt payload declares.
 */
export function toGoodsReceiptPayload(receipt: (IGoodsReceipt & { movementIds?: ID[]; outstandingQuantity?: DecimalString }) | null) {
	return {
		goodsReceipt: receipt,
		movementIds: receipt?.movementIds ?? [],
		outstandingQuantity: receipt?.outstandingQuantity ?? null,
		userErrors: []
	};
}

/**
 * @param error The error a service threw.
 * @returns The goods-receipt payload a failed mutation answers with.
 */
export function toFailedGoodsReceiptPayload(error: unknown) {
	return { goodsReceipt: null, movementIds: [], outstandingQuantity: null, userErrors: [toUserError(error)] };
}
