import { GoodsReceiptLineResolver } from './goods-receipt-line.resolver';
import { GoodsReceiptResolver } from './goods-receipt.resolver';
import { PurchaseOrderLineResolver } from './purchase-order-line.resolver';
import { PurchaseOrderResolver } from './purchase-order.resolver';
import { VendorProductTermResolver } from './vendor-product-term.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces run
 * through one implementation of every rule.
 */
export const resolvers = [
	PurchaseOrderResolver,
	PurchaseOrderLineResolver,
	GoodsReceiptResolver,
	GoodsReceiptLineResolver,
	VendorProductTermResolver
];

export {
	PurchaseOrderResolver,
	PurchaseOrderLineResolver,
	GoodsReceiptResolver,
	GoodsReceiptLineResolver,
	VendorProductTermResolver
};
