import { BadRequestException } from '@nestjs/common';

/**
 * The changes an update mutation states, from either of its two arguments.
 *
 * The update mutations of this package used to take the create input — `updateStockAlert(id, input:
 * StockAlertInput!)` — whose members a create requires (`variantId!`, `threshold!`), so an edit had to
 * restate the rule to change one member of it, and carried the create's `idempotencyKey` into the write
 * (review R2-G41). Each such mutation now also takes `patch`, a partial input whose every member is
 * optional; the older `input` argument keeps working exactly as before, so a client that sends it is
 * answered the same. Stating both is refused rather than merged, because which one wins would be a guess.
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
