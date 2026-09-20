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

/*
|--------------------------------------------------------------------------
| The carrier label, as this domain sees it
|--------------------------------------------------------------------------
*/

/**
 * One request for a label, or for the label a carrier already issued.
 *
 * What travels here is the parcel as this domain recorded it and nothing else: the strategy the
 * caller named, the service level the shipment was sold at, the number the carrier issued when it
 * took the goods, and the identifiers that let a provider correlate the document with the shipment
 * and the order behind it. The request carries no credentials and no address of its own, because an
 * account is the integration framework's and a destination is the order's.
 */
export interface ILabelRequest {
	/** The shipment the label belongs to. */
	readonly fulfillmentId: ID;
	/** The registered carrier strategy the label is requested from. */
	readonly providerId: string;
	/** The number the carrier issued when it took the parcel. A label is issued against one. */
	readonly trackingNumber: string;
	/** The order the parcel satisfies, so the provider can correlate it with the buyer's reference. */
	readonly orderId: ID;
	/** The service level the shipment travels at, when the fulfilment records one. */
	readonly service?: string;
	/** The carrier's own name, when the fulfilment records one. */
	readonly carrier?: string;
	/** The direction of the journey, so a provider knows which address is the destination. */
	readonly direction?: string;
	/** The location the parcel leaves from, when the shipment names one. */
	readonly warehouseId?: ID;
}

/**
 * The label a carrier issued.
 *
 * The two members are exactly what the fulfilment table keeps for a label, and nothing else is
 * accepted from a provider: a document reference a client fetches, and the provider's own payload for
 * it. The number, the carrier and the service are not part of the answer because they are what the
 * request was predicated on — a label is issued for the parcel that was handed over, not for one the
 * answer re-describes.
 */
export interface ICarrierLabel {
	/** Where the label document is fetched from. */
	readonly labelUrl: string;
	/** The provider's own payload: the document reference and its dimensions. */
	readonly labelData: Record<string, unknown>;
}

/**
 * The carrier as this domain sees it.
 *
 * A label is issued by a carrier through a provider, and this domain owns neither the carrier nor the
 * account it is billed to: what it owns is the shipment the label belongs to and the two columns the
 * label is recorded in. The seam is therefore declared here and satisfied elsewhere — an installation
 * that has a carrier integration binds a provider that answers this, and one that has none leaves the
 * token unbound.
 *
 * **Why a port rather than an imported adapter.** A package that imported a carrier SDK would make
 * that carrier a dependency of every installation, and would have to be edited to admit a second one.
 * The declaration is the consumer's, the implementation is the provider's, and neither package has to
 * be installed for the other to boot — the arrangement the stock ledger, the refund gateway and the
 * order capability are all reached through.
 *
 * **Why the key is an argument rather than the binding.** The strategy a caller names is a body member
 * of the route, and a tenant configures several carriers at once. One binding therefore serves every
 * registered strategy and resolves the key it is handed; a key the bound provider does not serve is
 * that provider's own refusal, which is why this domain answers only for the case it can see — that no
 * provider is registered at all.
 */
export interface IFulfillmentLabelProviderPort {
	/**
	 * Issues a label for a shipment, or answers the one it already issued.
	 *
	 * Requesting a label a carrier has already issued is the same call: a provider re-fetches the
	 * document it holds for the tracking number rather than issuing a second one, and the caller
	 * cannot tell the two apart — which is what makes the route safe to repeat.
	 *
	 * @param request The parcel, as this domain recorded it.
	 * @returns The label document and the provider's payload for it.
	 */
	requestLabel(request: ILabelRequest): Promise<ICarrierLabel>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the carrier label provider is injected under.
 *
 * Optional on purpose: a tenant that ships without a carrier integration records tracking by hand,
 * while a tenant that has one gets the label written by the provider rather than invented here. The
 * absence is reported rather than absorbed — the route answers
 * `FULFILLMENT_LABEL_UNAVAILABLE`, which is the code the API specification already assigns to "no
 * label could be produced".
 */
export const FULFILLMENT_LABEL_PROVIDER = Symbol('FULFILLMENT_LABEL_PROVIDER');
