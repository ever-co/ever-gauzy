import { BadRequestException } from '@nestjs/common';

/**
 * The changes an update mutation states, from either of its two arguments.
 *
 * `updateShippingProfile` and `updateShippingOption` used to take the create inputs —
 * `CreateShippingProfileInput!`, `CreateShippingOptionInput!` — whose members a create requires (`name!`,
 * `code!`, `priceType!`), so an edit had to restate the row to change one member of it, and the create's
 * `idempotencyKey` was carried into the write (review R2-G41). Each now also takes `patch`, a partial input
 * whose every member is optional; the older `input` argument keeps working exactly as before, so a client
 * that sends it is answered the same. Stating both is refused rather than merged, because which one wins
 * would be a guess.
 *
 * @param input The older, create-shaped argument, when the caller sent it.
 * @param patch The partial argument, when the caller sent it.
 * @returns The changes, as one object.
 * @throws BadRequestException (`UPDATE_INPUT_AMBIGUOUS`) when both are stated, and (`UPDATE_INPUT_REQUIRED`)
 * when neither is.
 */
export function updateChanges<T extends object>(input?: T | null, patch?: T | null): T {
	const statedInput = input !== undefined && input !== null;
	const statedPatch = patch !== undefined && patch !== null;

	if (statedInput && statedPatch) {
		throw new BadRequestException(
			'UPDATE_INPUT_AMBIGUOUS: state the changes once — as `patch`, or as the older `input` — not both.'
		);
	}

	if (!statedInput && !statedPatch) {
		throw new BadRequestException('UPDATE_INPUT_REQUIRED: state the changes as `patch` (or the older `input`).');
	}

	return (statedPatch ? patch : input) as T;
}

/**
 * The members of a create input an edit never writes.
 *
 * `idempotencyKey` is a request member, not a column: handed to the ORM's update it is a property the
 * entity does not have, which TypeORM refuses for the whole statement.
 *
 * @param changes The changes the caller stated.
 * @returns The changes without the request-only members.
 */
export function withoutRequestMembers<T extends Record<string, any>>(changes: T): Omit<T, 'idempotencyKey'> {
	const { idempotencyKey, ...values } = changes ?? ({} as T);

	void idempotencyKey;

	return values;
}
