import { CreateCartTables1791000000200 } from './migrations/1791000000200-CreateCartTables';
import { AddCartVersionColumn1791000000570 } from './migrations/1791000000570-AddCartVersionColumn';
import { AddCartTokenHashColumn1791000000660 } from './migrations/1791000000660-AddCartTokenHashColumn';
import { AddCartCheckoutClaimColumns1791000000781 } from './migrations/1791000000781-AddCartCheckoutClaimColumns';

export { CreateCartTables1791000000200 } from './migrations/1791000000200-CreateCartTables';
export { AddCartVersionColumn1791000000570 } from './migrations/1791000000570-AddCartVersionColumn';
export { AddCartTokenHashColumn1791000000660 } from './migrations/1791000000660-AddCartTokenHashColumn';
export { AddCartCheckoutClaimColumns1791000000781 } from './migrations/1791000000781-AddCartCheckoutClaimColumns';

/**
 * The plugin's migration set, in run order.
 *
 * The set is contiguous and its files are ordered by their own timestamps, so the platform can merge
 * it into the connection's migration list without knowing which plugin it came from. The set runs
 * after the catalogue, pricing, tax and inventory sets, whose tables its foreign keys reference, and
 * before the order set, which adds the constraint this set deliberately leaves off
 * `commerce_cart.orderId`.
 *
 * The array lives here rather than beside the migration classes so that every file in the
 * `migrations/` directory is a migration and nothing else.
 */
export const ALL_CART_MIGRATIONS = [
	CreateCartTables1791000000200,
	AddCartVersionColumn1791000000570,
	AddCartTokenHashColumn1791000000660,
	AddCartCheckoutClaimColumns1791000000781
];
