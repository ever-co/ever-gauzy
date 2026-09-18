import { DecimalString, ID } from '@gauzy/contracts';

/**
 * The shapes this domain answers another domain's question with.
 *
 * A capability another package needs is reached through a port that the *consumer* declares, so the
 * two packages never import each other and either can be installed alone. What the provider side owns
 * is the answer: the consumer's port is satisfied structurally, and the shapes below are this
 * domain's own statement of what a shipment line, a departed shipment and a return leg are — declared
 * here rather than borrowed, because a provider that imported the consumer's declarations would make
 * the two packages one package again.
 *
 * Nothing here is a table. Each shape is a projection of the rows this package already keeps, and the
 * sections of the services that answer with them say which column each member comes from.
 */

/**
 * One line of a shipment that has not left yet.
 *
 * This is what a picking list is derived from, which is why the quantity is the shipment's own and
 * why the variant is resolved rather than assumed: a picker is told what to fetch and how much of it,
 * and the shipment is the only thing that knows how much it still asks for.
 */
export interface IShippableLine {
	/** The shipment line. */
	readonly fulfillmentLineId: ID;
	/** The shipment it belongs to. */
	readonly fulfillmentId: ID;
	/** The order line it satisfies, when the shipment names one. */
	readonly orderLineId?: ID;
	/** The order it satisfies, when the shipment names one. */
	readonly orderId?: ID;
	/** The variant expected in the bin, resolved from the order line the shipment satisfies. */
	readonly variantId: ID;
	/** What the shipment asks for, as an exact decimal. */
	readonly quantity: DecimalString;
	/** The location the goods leave from. */
	readonly warehouseId?: ID;
}

/**
 * One shipment that has left a location.
 *
 * A manifest is the custody boundary a carrier signs for, so this is the read that decides what a
 * manifest covers: where it left from, who took it, on what service and when.
 */
export interface IShippedShipment {
	/** The shipment. */
	readonly fulfillmentId: ID;
	/** The location it left from. */
	readonly warehouseId?: ID;
	/** The order it satisfies. */
	readonly orderId?: ID;
	/** The carrier that took it. */
	readonly carrier?: string;
	/** The service level it was sent on. */
	readonly service?: string;
	/** When it left the building. */
	readonly shippedAt?: Date;
	/** The carrier's tracking number. */
	readonly trackingNumber?: string;
}

/** One request to raise the outbound leg a return or an exchange travels on. */
export interface IReturnLegRequest {
	/** Return the goods belong to. */
	readonly returnId: ID;
	/** Order the goods came from. */
	readonly orderId: ID;
	/** Chosen return shipping option, when the tenant configured one. */
	readonly shippingOptionId?: ID;
	/** Location the goods are collected from. */
	readonly warehouseId?: ID;
	/** Carrier tracking number, when it is already known. */
	readonly trackingNumber?: string;
}

/** What the raise of a return leg answers with. */
export interface IReturnLeg {
	/** The shipment that carries the return leg. */
	readonly fulfillmentId: ID;
	/** Carrier tracking number, when the carrier issued one. */
	readonly trackingNumber?: string;
	/** Label the customer prints, when the carrier issued one. */
	readonly labelUrl?: string;
}
