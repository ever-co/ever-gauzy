import { Order } from '../order/order.entity';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderChange } from '../order-change/order-change.entity';
import { OrderChangeAction } from '../order-change-action/order-change-action.entity';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderHistory } from '../order-history/order-history.entity';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineInvoice } from '../order-line-invoice/order-line-invoice.entity';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderSummary } from '../order-summary/order-summary.entity';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';

export { Order } from '../order/order.entity';
export { OrderAddress } from '../order-address/order-address.entity';
export { OrderChange } from '../order-change/order-change.entity';
export { OrderChangeAction } from '../order-change-action/order-change-action.entity';
export { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
export { OrderHistory } from '../order-history/order-history.entity';
export { OrderLine } from '../order-line/order-line.entity';
export { OrderLineInvoice } from '../order-line-invoice/order-line-invoice.entity';
export { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
export { OrderSummary } from '../order-summary/order-summary.entity';
export { OrderTransaction } from '../order-transaction/order-transaction.entity';

/**
 * Every entity this plugin owns.
 *
 * The array is the single source for the plugin's `entities` metadata and for the per-ORM feature
 * registration of its module. The order aggregate has eleven tables and all eleven are here exactly
 * once: a table that reaches the ORM through one path and not the other is a boot-time metadata
 * failure, and a hand-maintained list is how that happens.
 *
 * `order_line_invoice` is the pivot that replaced a single column: one order line is billed through
 * many invoice items, across many invoices, and a credit note's negative item is linked back to the
 * line it credited through the same table.
 */
export const ALL_ORDER_ENTITIES = [
	Order,
	OrderLine,
	OrderLineInvoice,
	OrderAddress,
	OrderShippingMethod,
	OrderSummary,
	OrderTransaction,
	OrderChange,
	OrderChangeAction,
	OrderCreditLine,
	OrderHistory
];
