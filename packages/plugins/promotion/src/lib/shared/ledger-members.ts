import { BadRequestException } from '@nestjs/common';
import { restatesStoredValue } from '@gauzy/common';

/** How a refusal of {@link withoutRestatedMembers} names what was refused. */
export interface ILedgerMemberRefusal {
	/** The error code, e.g. `PROMOTION_FIELD_NOT_WRITABLE`. */
	readonly code: string;
	/** What the row is, in the message: "a promotion", "a coupon". */
	readonly subject: string;
	/** How those members do move, in the message. */
	readonly movedBy: string;
	/** Carried into `details` beside the refused fields, e.g. the row's identifier. */
	readonly details?: Record<string, unknown>;
}

/**
 * A write body without the members only the row's own operations move (review R2-G27/G28).
 *
 * The counters of this package (`promotion.usageCount`, `promotion.budgetSpent`, `coupon.usageCount`,
 * `campaign_budget.used`) are caches of the usage ledgers: the checkout consumes them through one conditional
 * statement and the reversion gives them back, so a value written by hand silently re-opens a used-up limit or a
 * spent budget. A parent key (`campaign_budget.campaignId`) moves a ceiling onto another campaign. The REST bodies
 * are `PartialType`s of the create shapes and so admitted all of them, while the GraphQL inputs never did.
 *
 * The rule is the gift card's (`GIFT_CARD_FIELD_NOT_WRITABLE`, review R3-06): a body that **restates** the value
 * the write leaves in place is accepted and the member left out of the write (a client that sends back the row it
 * read keeps working); a body that would **change** it is refused with the stated code, naming the fields.
 *
 * @param patch The body as the route or the field handed it over.
 * @param members The members only the row's own operations move.
 * @param baseline What the write leaves in place: the stored row on an update, the starting values on a create.
 * `null` means nothing is known, so any stated member is refused.
 * @param refusal How the refusal is worded.
 * @returns A copy of the body without the members.
 * @throws BadRequestException with `refusal.code` when a member would change.
 */
export function withoutRestatedMembers<T extends object>(
	patch: T,
	members: readonly string[],
	baseline: object | null,
	refusal: ILedgerMemberRefusal
): T {
	const body = { ...((patch ?? {}) as Record<string, unknown>) };
	const named = members.filter((member) => body[member] !== undefined);

	if (named.length === 0) {
		return body as T;
	}

	const held = (baseline ?? null) as Record<string, unknown> | null;
	const moved = named.filter((member) => !held || !restatesStoredValue(held[member], body[member]));

	if (moved.length > 0) {
		throw new BadRequestException({
			message:
				`${refusal.code}: ${moved.join(', ')} of ${refusal.subject} ${moved.length === 1 ? 'is' : 'are'} ` +
				`not written from a request body: ${refusal.movedBy}`,
			code: refusal.code,
			details: { ...(refusal.details ?? {}), fields: moved }
		});
	}

	for (const member of named) {
		delete body[member];
	}

	return body as T;
}
