import { HttpException } from '@nestjs/common';
import { DecimalString } from '@gauzy/contracts';
import { formatDecimalUnits, STORAGE_SCALE, toUnitsAtScale } from '@gauzy/core';
import { IUserError } from './types';

/**
 * The wire shapes a resolver answers with.
 *
 * A mutation reports an outcome the caller could have avoided in `userErrors` and the operation
 * itself succeeds; only a request that could not have been made correctly becomes a GraphQL error.
 * The code is the platform code the service raised — the convention is a `CODE:` prefix, or the bare
 * code as the whole message — and is derived from the HTTP status otherwise, so a client sees one
 * vocabulary across the two surfaces.
 *
 * `toDecimal` carries the other half of the schema's promise about money. A `numeric(20,6)` column is
 * read back through the ORM's numeric transformer, which hands over a JavaScript number; the kernel's
 * `Decimal` scalar is documented as an exact decimal with six fractional digits, so every money member
 * is put back into that form on the way out rather than left as the float the transformer produced.
 * The arithmetic is the kernel's own — scaled integers, never a binary fraction — so a figure read
 * here and the same figure read over REST are string-identical.
 */

/** The codes this domain raises that a client is expected to branch on. */
const KNOWN_CODES = [
	'PROMOTION_ALREADY_APPLIED',
	'PROMOTION_NO_ACTIONS',
	'PROMOTION_NOT_FOUND',
	'CAMPAIGN_IDENTIFIER_REQUIRED',
	'CAMPAIGN_NOT_FOUND',
	'CAMPAIGN_BUDGET_INVALID',
	'CAMPAIGN_BUDGET_NOT_FOUND',
	'COUPON_INVALID',
	'COUPON_NOT_FOUND',
	'COUPON_NOT_LINKED',
	'COUPON_INACTIVE',
	'COUPON_EXPIRED',
	'COUPON_LIMIT_EXCEEDED',
	'COUPON_CUSTOMER_LIMIT_EXCEEDED',
	'GIFT_CARD_INVALID',
	'GIFT_CARD_NOT_FOUND',
	'GIFT_CARD_ALREADY_REDEEMED',
	'GIFT_CARD_EXPIRED',
	'GIFT_CARD_CURRENCY_MISMATCH',
	'GIFT_CARD_INSUFFICIENT_BALANCE'
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
 * Turns a filter the schema declared into the `where` the services accept.
 *
 * The two are the same object by design: every member of a filter names one column and every member
 * is an equality, so the filter crosses the boundary unchanged. A member the caller left out filters
 * nothing — which is what makes a filter built up field by field behave — and it is dropped rather
 * than passed through as a null, because a null in a `where` is a condition of its own.
 *
 * @param filter The filter as the schema declared it.
 * @returns The conditions to read with.
 */
export function toWhere(filter?: object | null): Record<string, unknown> {
	const where: Record<string, unknown> = {};

	for (const [member, value] of Object.entries((filter ?? {}) as Record<string, unknown>)) {
		if (value === undefined || value === null) {
			continue;
		}

		where[member] = value;
	}

	return where;
}

/**
 * @param value A money value, as the ORM read it.
 * @returns It as an exact decimal with the storage scale, which is what the `Decimal` scalar carries.
 */
export function toDecimal(value: DecimalString | number | null | undefined): DecimalString | null {
	if (value === null || value === undefined) {
		return null;
	}

	try {
		return formatDecimalUnits(toUnitsAtScale(value, STORAGE_SCALE), STORAGE_SCALE);
	} catch (error) {
		// A value the column cannot hold is reported as it stands rather than failing the read it
		// belongs to: the write path is what refuses an amount that is not an exact decimal.
		return String(value);
	}
}
