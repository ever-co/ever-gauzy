import { ID } from '@gauzy/contracts';
import { EntitlementKind } from './entitlement.enums';
import { IEntitlementGrantInput } from './entitlement.types';

/**
 * How a right's number was arrived at.
 *
 * `derived` says the number was built from the purchase that granted the right rather than taken from the
 * numbering series or from the caller, which is the one case where the grant may choose another one when
 * the first is already held (see {@link deriveEntitlementNumber}).
 */
export interface IEntitlementNumber {
	readonly value: string;
	readonly derived: boolean;
}

/**
 * How many numbers derived from one provenance a grant tries before it reports the collision.
 *
 * A derived number is held by another right when the line or subscription was granted before and that right
 * was revoked (a revoked right keeps its number, because a licence audit has to be able to read it), or, far
 * more rarely, when two purchases share the eight-character prefixes the number is built from. Each attempt
 * after the first is one more revision of the same number, so ten covers a line re-granted nine times.
 */
export const DERIVED_ENTITLEMENT_NUMBER_ATTEMPTS = 10;

/**
 * Derives a right's number from the purchase that granted it.
 *
 * An event consumer has no request context — the numbering series is read from one — so a grant replayed
 * from an order or a subscription is numbered from its own provenance instead: deterministic, unique per
 * granting line and kind, and saying which purchase it came from (`E-<order>-<line>-<kind>`, or
 * `E-SUB-<subscription>-<kind>`).
 *
 * The first right of a provenance carries the number as it always did. A later one — the line was granted
 * again after its right was revoked — carries the next revision (`…-L-2`, `…-L-3`): the revoked right keeps
 * the number it was issued under, and `UQ_entitlement_number` holds it, so re-using it would refuse the new
 * grant outright (#11023). The longest form stays well inside the column's 32 characters.
 *
 * @param input What grants the right.
 * @param revision Which revision of the number to derive: `0` for the first right of the provenance.
 * @returns The number, or `undefined` when the right came from no purchase.
 */
export function deriveEntitlementNumber(
	input: Pick<IEntitlementGrantInput, 'kind' | 'orderId' | 'orderLineId' | 'subscriptionId'>,
	revision = 0
): string | undefined {
	const kind = (input.kind ?? EntitlementKind.LICENCE).charAt(0);
	const short = (value: ID): string => String(value).replace(/-/g, '').slice(0, 8).toUpperCase();

	let number: string;

	if (input.orderId && input.orderLineId) {
		number = `E-${short(input.orderId)}-${short(input.orderLineId)}-${kind}`;
	} else if (input.subscriptionId) {
		number = `E-SUB-${short(input.subscriptionId)}-${kind}`;
	} else {
		return undefined;
	}

	return revision > 0 ? `${number}-${revision + 1}` : number;
}
