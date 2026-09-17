import { CreateOrderTables1791000000220 } from './migrations/1791000000220-CreateOrderTables';
import { AddPaymentOrderForeignKey1791000000230 } from './migrations/1791000000230-AddPaymentOrderForeignKey';

export { CreateOrderTables1791000000220 } from './migrations/1791000000220-CreateOrderTables';
export { AddPaymentOrderForeignKey1791000000230 } from './migrations/1791000000230-AddPaymentOrderForeignKey';

/**
 * The plugin's migration set, in run order.
 *
 * The first file creates the ten tables of the aggregate; the second adds the two foreign keys that
 * point at `order` from tables this package does not own — the kernel's additive `payment.orderId` and
 * the cart's `commerce_cart.orderId` — because the set that creates a target is the set that constrains
 * it. Both files carry all three dialects and a `down()` that is a true inverse.
 *
 * The array lives here rather than beside the migration classes so that every file in the `migrations/`
 * directory is a migration and nothing else.
 */
export const ALL_ORDER_MIGRATIONS = [
	CreateOrderTables1791000000220,
	AddPaymentOrderForeignKey1791000000230
];
