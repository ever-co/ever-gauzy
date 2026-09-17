import { CreateFulfillmentTables1791000000240 } from './migrations/1791000000240-CreateFulfillmentTables';
import { AddCartShippingOptionForeignKey1791000000250 } from './migrations/1791000000250-AddCartShippingOptionForeignKey';

export { CreateFulfillmentTables1791000000240 } from './migrations/1791000000240-CreateFulfillmentTables';
export { AddCartShippingOptionForeignKey1791000000250 } from './migrations/1791000000250-AddCartShippingOptionForeignKey';

/**
 * The plugin's migration set, in run order.
 *
 * The first file creates the five tables of the domain; the second adds the two foreign keys whose
 * targets this set creates and whose source columns earlier sets could not constrain — the cart's and
 * the order's chosen shipping option. Both files carry all three dialects and a `down()` that is a true
 * inverse.
 *
 * The array lives here rather than beside the migration classes so that every file in the `migrations/`
 * directory is a migration and nothing else.
 */
export const ALL_FULFILLMENT_MIGRATIONS = [
	CreateFulfillmentTables1791000000240,
	AddCartShippingOptionForeignKey1791000000250
];
