/**
 * The ids a right holds of rows of other packages: the customer it was granted to, and the order line, subscription,
 * product and variant it was granted for.
 *
 * `grant` writes them on the transaction's manager, past the platform's cross-tenant check, as `POST /entitlements`,
 * `grantEntitlement` or a replayed order event names them. A right granted to tenant B's customer then loaded that
 * contact (name, email, phone, notes) on every read of the right, since `customer` is a relation and the join is not
 * held to a tenant.
 *
 * `grant` holds these columns to the right's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The id columns a granted right is written with. */
export const ENTITLEMENT_REFERENCES: PlainReferenceColumns = {
	customerId: 'organization_contact',
	orderId: 'order',
	orderLineId: 'order_line',
	subscriptionId: 'subscription',
	productId: 'product',
	variantId: 'product_variant'
};
