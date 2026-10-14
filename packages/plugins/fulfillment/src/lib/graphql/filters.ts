import { FulfillmentDirection, FulfillmentStatusDetail } from '@gauzy/contracts';

/**
 * The state filters the fulfilment schema accepts, read into the enumerations the columns carry.
 *
 * A filter argument is declared as a `String` in the schema, so the value arrives as text and has to
 * be narrowed before it can stand as a predicate on an enumerated column. The narrowing is explicit
 * for that reason: an unknown value is refused rather than handed to the query, where it would match
 * nothing and read to the caller as an empty page rather than as a mistyped status.
 */
export const FULFILLMENT_DIRECTIONS: readonly string[] = Object.values(FulfillmentDirection);
export const FULFILLMENT_STATUS_DETAILS: readonly string[] = Object.values(FulfillmentStatusDetail);

/**
 * @param value A direction as the filter argument carried it.
 * @returns Whether it names one of the two ways a shipment moves goods.
 */
export function isFulfillmentDirection(value: unknown): value is FulfillmentDirection {
	return typeof value === 'string' && FULFILLMENT_DIRECTIONS.includes(value);
}

/**
 * @param value A status as the filter argument carried it.
 * @returns Whether it names one of a shipment's own states.
 */
export function isFulfillmentStatusDetail(value: unknown): value is FulfillmentStatusDetail {
	return typeof value === 'string' && FULFILLMENT_STATUS_DETAILS.includes(value);
}
