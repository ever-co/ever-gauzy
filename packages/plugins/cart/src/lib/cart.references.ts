/**
 * The ids a cart's child rows hold of rows they have no relation to (security audit P0 #6c).
 *
 * A line names its product, variant, seller, tax class, location and subscription plan; an applied promotion its
 * promotion and coupon; a delivery choice its shipping option and tax class. None of those columns is a relation: most
 * of their tables belong to packages installed after this one, so they carry no foreign key either
 * (`CreateCartTables1791000000200`). The platform's cross-tenant check reads the relation join columns of a written
 * row, so it never saw them, and every write of the three child rows — the generic routes, the cart's own line,
 * delivery and promotion verbs on both protocols, the merge — stored another tenant's ids as given.
 *
 * The services hold these columns to the caller's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/**
 * The plain id columns of a cart itself: its sales channel, region, customer and user. `POST /carts`, `PUT /carts/:id`,
 * `updateCart` and `associateCartWithContact` stored another tenant's as given, and the order a checkout builds copies
 * them.
 */
export const CART_REFERENCES: PlainReferenceColumns = {
	channelId: 'channel',
	regionId: 'region',
	customerId: 'organization_contact',
	userId: 'user'
};

/** The plain id columns of a cart line. */
export const CART_LINE_REFERENCES: PlainReferenceColumns = {
	productId: 'product',
	variantId: 'product_variant',
	sellerId: 'seller',
	taxCategoryId: 'tax_category',
	warehouseId: 'warehouse',
	subscriptionPlanId: 'subscription_plan'
};

/** The plain id columns of an applied promotion. */
export const CART_PROMOTION_REFERENCES: PlainReferenceColumns = {
	promotionId: 'promotion',
	couponId: 'coupon'
};

/** The plain id columns of a delivery choice. */
export const CART_SHIPPING_METHOD_REFERENCES: PlainReferenceColumns = {
	shippingOptionId: 'shipping_option',
	taxCategoryId: 'tax_category'
};
