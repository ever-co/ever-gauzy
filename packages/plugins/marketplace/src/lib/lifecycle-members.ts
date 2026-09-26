import { BadRequestException } from '@nestjs/common';

/**
 * Refuses an edit that names a member only a lifecycle operation of the resource may write.
 *
 * A payout and a settlement each carry a status and a set of figures that are *derived* — from the
 * ledger rows a payout was built from, from the provider's report a settlement transcribes, from the
 * reconciliation that compared the two — and each has dedicated operations that move them under their own
 * grant and their own checks: approve, pay, cancel and retry for a payout; reconcile, close and dispute
 * for a settlement. The generic edit (`PUT /:id`, `update<Resource>`) is the correction path for what the
 * row *states about itself*, and it writes whatever partial it is handed, so a member it could name here
 * is a lifecycle operation reached without that operation's checks — a `DRAFT` payout marked `PAID` by a
 * caller who may only prepare one, or a `PAID` payout moved back to `APPROVED` so it could be paid again.
 *
 * The REST DTOs and the GraphQL inputs no longer declare these members, so neither protocol can carry
 * them; this is the refusal behind both, stated where the write is, so a caller that reaches the service
 * any other way is answered the same. A member counts as named when it carries a value — `undefined` is
 * how a DTO instance and an input both spell "not stated" — and `null` is a value, because writing
 * `null` over a derived figure is an edit of it.
 *
 * @param partial The partial the edit would write.
 * @param members The members only a lifecycle operation writes.
 * @param code The stable refusal code a client switches on.
 * @param operations How the resource's lifecycle is moved instead, for the message.
 * @throws BadRequestException naming every refused member the partial carries.
 */
export function assertNoLifecycleMembers(
	partial: unknown,
	members: readonly string[],
	code: string,
	operations: string
): void {
	if (!partial || typeof partial !== 'object') {
		return;
	}

	const named = members.filter((member) => (partial as Record<string, unknown>)[member] !== undefined);

	if (named.length > 0) {
		throw new BadRequestException(
			`${code}: ${named.join(', ')} ${named.length === 1 ? 'is' : 'are'} not written by an edit; ${operations}.`
		);
	}
}
