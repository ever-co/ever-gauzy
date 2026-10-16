/**
 * The ids the fulfilment package's rows hold of rows they have no relation to (security audit P0 #6c).
 *
 * A shipment names the order it ships and the location it ships from; a shipment line the order line it ships and
 * the location its units came from; a variant's shipping-profile attachment the variant. None of those columns is a
 * relation, so the platform's cross-tenant check, which reads the relation join columns of a written row, never saw
 * them: `POST` / `PUT` on `/fulfillments`, `/fulfillments/returns`, `/fulfillment-lines` and
 * `/shipping-profile-variants`, `createFulfillment`, `updateFulfillment`, `updateFulfillmentLine`,
 * `assignShippingProfileVariant` and the lines a shipment is created with stored another tenant's ids as given. The
 * attachment is the sharpest of them: `variantId` is unique across tenants (`UQ_shipping_profile_variant_one`), so
 * attaching tenant B's variant to one of A's profiles kept B from attaching its own variant at all.
 *
 * The services hold these columns to the caller's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The plain id columns of a shipment. */
export const FULFILLMENT_REFERENCES: PlainReferenceColumns = {
	orderId: 'order',
	warehouseId: 'warehouse'
};

/** The plain id columns of a shipment line. */
export const FULFILLMENT_LINE_REFERENCES: PlainReferenceColumns = {
	orderLineId: 'order_line',
	warehouseId: 'warehouse'
};

/** The plain id column of a variant's shipping-profile attachment. */
export const SHIPPING_PROFILE_VARIANT_REFERENCES: PlainReferenceColumns = {
	variantId: 'product_variant'
};
