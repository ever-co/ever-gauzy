import { DecimalString, FulfillmentStatusDetail, ID } from '@gauzy/contracts';
import { IVersionExpectation, VERSION_EXPECTATION_PROPERTY } from '@gauzy/core';

/*
|--------------------------------------------------------------------------
| What a shipment announces
|--------------------------------------------------------------------------
*/

/**
 * The aggregate name every `fulfillment.*` outbox row is written under.
 *
 * The outbox partitions by `<aggregateType>:<aggregateId>` and promises ordering inside a partition
 * and nowhere else, so this string is what makes "one parcel's events arrive in the order they
 * happened" true — a shipment that was delivered cannot be announced before it was shipped. It is a
 * constant rather than a literal at each call site for exactly that reason.
 */
export const FULFILLMENT_AGGREGATE_TYPE = 'FULFILLMENT';

/**
 * The fact each lifecycle status announces when a shipment reaches it.
 *
 * A shipment is what the buyer's notifications, the outbound webhooks and the search index are driven
 * by, and none of them could observe one: this package emitted nothing at all, so a parcel could be
 * handed over, tracked and delivered without anything outside it learning of it. The map is keyed by
 * the status rather than written at each caller so that the lifecycle and the events it announces
 * cannot drift: a status added to the machine has no event until it is named here, which is a
 * compile-time failure rather than a silent omission.
 */
export const FULFILLMENT_EVENTS: Record<FulfillmentStatusDetail, string> = {
	/** The shipment exists and is waiting to be picked. */
	[FulfillmentStatusDetail.PENDING]: 'fulfillment.created',
	/** The carrier has taken the parcel. */
	[FulfillmentStatusDetail.SHIPPED]: 'fulfillment.shipped',
	/** The carrier reported movement. */
	[FulfillmentStatusDetail.IN_TRANSIT]: 'fulfillment.in_transit',
	/** The goods reached the buyer. */
	[FulfillmentStatusDetail.DELIVERED]: 'fulfillment.delivered',
	/** The shipment was abandoned before anything was handed over. */
	[FulfillmentStatusDetail.CANCELED]: 'fulfillment.canceled'
};

/*
|--------------------------------------------------------------------------
| The version a write of a shipment is predicated on
|--------------------------------------------------------------------------
*/

/**
 * The version a write that no caller conditioned on is predicated on.
 *
 * A shipment carries a `version`, and every write of it is a conditional `UPDATE … WHERE id = :id AND
 * version = :expected`. A route is predicated on the version its caller stated; a write that arrives
 * from anywhere else — a carrier callback, a return leg raised by the returns package, a caller inside
 * the platform — has no client version behind it and is predicated on the version the row holds when
 * the statement runs. The wildcard is therefore not an escape from the protection: the comparison and
 * the increment are still one statement, so a shipment that moved on between the read and the write is
 * refused either way. What it is *not* is a licence to skip the conditional write, which is what an
 * application-computed `version + 1` amounts to.
 */
export const ANY_FULFILLMENT_VERSION: IVersionExpectation = { wildcard: true, versions: [] };

/**
 * The version a request accepted, when it stated one.
 *
 * The platform's own reader refuses a request that states none, which is right for a route that
 * **demands** a version — `POST :id/label` does — and wrong for the four transition routes, which
 * honour one when it is offered and stay usable by a carrier callback that has never read an `ETag`.
 * The expectation the guard left on the request is therefore read directly, and its absence means the
 * wildcard rather than a refusal.
 *
 * @param request The request the version guard ran on, when the route carries `@Versioned()`.
 * @returns What the caller accepted, or the wildcard when it stated nothing.
 */
export function fulfillmentVersionOf(request: unknown): IVersionExpectation {
	const expectation = (request as Record<string, unknown> | null | undefined)?.[VERSION_EXPECTATION_PROPERTY];

	return (expectation as IVersionExpectation) ?? ANY_FULFILLMENT_VERSION;
}

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
