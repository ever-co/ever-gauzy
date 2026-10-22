/**
 * The ids an order holds of rows it has no relation to.
 *
 * An order names its sales channel, region, customer, user, the cart it came from, the order it was split from and its
 * payment term. None of those columns is a relation, so the platform's cross-tenant check, which reads the relation
 * join columns of a written row, never saw them: `POST /orders`, `PUT /orders/:id` on a draft and their GraphQL
 * mutations stored another tenant's ids as given. The customer is the one read back: the order's invoice is issued to
 * it, and the rights its lines grant are granted to it, and both load the contact.
 *
 * `OrderService` holds these columns to the caller's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The plain id columns of an order. */
export const ORDER_REFERENCES: PlainReferenceColumns = {
	channelId: 'channel',
	regionId: 'region',
	customerId: 'organization_contact',
	userId: 'user',
	cartId: 'commerce_cart',
	parentOrderId: 'order',
	paymentTermId: 'payment_term'
};
