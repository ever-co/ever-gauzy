import { FulfillmentDirection, FulfillmentStatusDetail, ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * What decides whether a shipment's rows may be removed outright.
 *
 * The order line's counters are caches of the shipment lines that caused them — `fulfilledQuantity` is
 * moved by an outbound shipment when it is created, `shippedQuantity` and `deliveredQuantity` as it
 * travels — and exactly one write gives them back: `FulfillmentService.cancel`, which returns the units
 * and re-derives the order. A removal that took a row those counters still count would leave them
 * counting units nothing will ship, and nothing downstream would notice: the outstanding remainder stays
 * at zero, every later shipment of the line is refused with `FULFILLMENT_QUANTITY_EXCEEDED`, the order
 * stays `FULFILLED`, and the nightly reconciliation, which derives from those same counters, agrees with
 * them. The rule is therefore stated once, here, and read by both removals — the shipment's and the
 * line's — so that neither protocol can reach a removal the other refuses.
 */

/** The two columns of a shipment the rule reads. */
export interface ICountedShipment {
	/** Which way the goods travel. A row that states none is outbound, which is the column's default. */
	direction?: FulfillmentDirection | null;
	/** Where the shipment is in its lifecycle. */
	status?: FulfillmentStatusDetail | null;
}

/**
 * Whether the order line's counters still count a shipment.
 *
 * A return leg never moved a counter — the rule `FulfillmentService.createReturnLeg` states — and a
 * cancelled outbound shipment has already given its units back, so neither is counted. Every other
 * outbound shipment is: a `PENDING` one holds `fulfilledQuantity`, and one that has left the building
 * holds `shippedQuantity` and `deliveredQuantity` as well, which no write gives back at all because goods
 * that moved are recorded rather than un-shipped.
 *
 * @param shipment The shipment as it was read, or nothing when it could not be read.
 * @returns True when a removal of the shipment, or of one of its lines, would desynchronise the counters.
 * A shipment that could not be read is counted: the answer is not known, and the removal is the act that
 * cannot be undone.
 */
export function isCountedShipment(shipment?: ICountedShipment | null): boolean {
	if (!shipment) {
		return true;
	}

	if (shipment.direction === FulfillmentDirection.RETURN) {
		return false;
	}

	return shipment.status !== FulfillmentStatusDetail.CANCELED;
}

/**
 * The criteria a removal is decided and made on, scoped by the organization the request states.
 *
 * The same object is handed to the read that decides whether the removal may happen and to the removal
 * itself, because the two have to select the same rows: a read scoped more narrowly than the statement
 * would let a row it did not see be removed without the check. The tenant is added by
 * `TenantAwareCrudService` to both, as it is to every read and write of this package; the organization is
 * added here, because the base class scopes a removal by tenant alone and a shipment of another
 * organization of the same tenant is not the caller's to remove. A member the request does not state is
 * left out rather than set to `undefined`, because a key present with an undefined value is a criterion
 * the two ORMs interpret differently.
 *
 * @param criteria A row's identifier, or the conditions that select the rows.
 * @returns The criteria, as an object, with the caller's organization when the request states one.
 */
export function removalCriteria(criteria: ID | object): Record<string, unknown> {
	const organizationId = RequestContext.currentOrganizationId();

	return {
		...(typeof criteria === 'string' ? { id: criteria } : { ...((criteria ?? {}) as Record<string, unknown>) }),
		...(organizationId ? { organizationId } : {})
	};
}
