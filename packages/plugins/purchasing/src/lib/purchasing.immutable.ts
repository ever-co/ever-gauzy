import { BadRequestException } from '@nestjs/common';
import { restatesStoredValue } from '@gauzy/common';

/**
 * The members of a patch that would change what a row already holds.
 *
 * A member the patch does not state is not a change. A member it states with the value the row already holds is
 * not a change either, so a client that sends a whole row back with one descriptive member edited is not refused
 * for the members it did not touch. What counts as the value already held is `restatesStoredValue`'s rule
 * (`@gauzy/common`): a date is compared as an instant, because a column reads back as a `Date` while a body states an
 * ISO string; everything else this is used for — identifiers and enumerations — is compared as exact text, and a
 * body value that only stringifies to the stored one (an array holding it) is a change. None of these members is an
 * amount, so no value is read as a decimal: a batch number `"10"` and `"10.0"` are two batches.
 *
 * @param stored The row as it is stored.
 * @param patch The members a caller asked to write.
 * @param members The members the caller may not move.
 * @returns The members the patch would move, in the order `members` lists them.
 */
export function movedMembers(
	stored: Record<string, unknown>,
	patch: Record<string, unknown>,
	members: readonly string[]
): string[] {
	return members.filter(
		(member) => patch[member] !== undefined && !restatesStoredValue(stored[member], patch[member], AS_TEXT)
	);
}

/** Reads no value as a decimal, so two decimal-looking identifiers are compared as the text they are. */
const AS_TEXT = { decimal: () => null };


/**
 * The refusal for a correction that would move a member a posted document's movements were decided on.
 *
 * The shape is the platform's: the code leads the message and travels beside it with the row and the members, so
 * a client can branch on the code and a reader of the log sees what was refused and why — the shape
 * `FULFILLMENT_IMMUTABLE` already answers with for the same class of refusal.
 *
 * @param code The refusal code.
 * @param message What was refused and what to do instead, without the code.
 * @param details The row and the members that were refused.
 * @returns The exception to throw.
 */
export function immutableMembers(code: string, message: string, details: Record<string, unknown>): BadRequestException {
	return new BadRequestException({ message: `${code}: ${message}`, code, details });
}
