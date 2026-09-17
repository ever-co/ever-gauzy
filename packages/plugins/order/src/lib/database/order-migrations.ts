import { CreateOrderTables1791000000220 } from './migrations/1791000000220-CreateOrderTables';
import { AddPaymentOrderForeignKey1791000000230 } from './migrations/1791000000230-AddPaymentOrderForeignKey';
import { CreateOrderLineInvoiceTable1791000000235 } from './migrations/1791000000235-CreateOrderLineInvoiceTable';

export { CreateOrderTables1791000000220 } from './migrations/1791000000220-CreateOrderTables';
export { AddPaymentOrderForeignKey1791000000230 } from './migrations/1791000000230-AddPaymentOrderForeignKey';
export { CreateOrderLineInvoiceTable1791000000235 } from './migrations/1791000000235-CreateOrderLineInvoiceTable';

/**
 * The plugin's migration set, in run order.
 *
 * The first file creates the ten tables of the aggregate; the second adds the two foreign keys that
 * point at `order` from tables this package does not own — the kernel's additive `payment.orderId` and
 * the cart's `commerce_cart.orderId` — because the set that creates a target is the set that constrains
 * it. The third creates `order_line_invoice`, adds the per-line registers the invoicing bridge reads
 * and writes, records the order's settlement schedule and its promise, and backfills one `INVOICE` row
 * per non-null `order_line.invoiceItemId` so an installation's existing 1:1 links land in the pivot
 * without anything being invented.
 *
 * All three files carry all three dialects and a `down()` that is a true inverse.
 *
 * The array lives here rather than beside the migration classes so that every file in the `migrations/`
 * directory is a migration and nothing else.
 */
export const ALL_ORDER_MIGRATIONS = [
	CreateOrderTables1791000000220,
	AddPaymentOrderForeignKey1791000000230,
	CreateOrderLineInvoiceTable1791000000235
];
