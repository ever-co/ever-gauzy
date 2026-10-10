import { CreatePurchasingTables1791000000340 } from './1791000000340-CreatePurchasingTables';
import { CreateVendorProductTermTable1791000000345 } from './1791000000345-CreateVendorProductTermTable';
import { AddGoodsReceiptLinePositiveCheck1791000000431 } from './1791000000431-AddGoodsReceiptLinePositiveCheck';

/**
 * Every migration this plugin owns, in run order.
 *
 * One array, spread into the plugin's `migrations` metadata, so the order a set runs in is readable
 * where the set is declared rather than inferred from file names alone: `CreatePurchasingTables` creates
 * the four documents, `CreateVendorProductTermTable` adds the agreement they are priced from —
 * including the columns and the index the documents gained for it — and
 * `AddGoodsReceiptLinePositiveCheck` states the rule that a receipt line brings something, which is a
 * rule about a table the first file creates and therefore cannot ride along with it.
 */
export const migrations = [
	CreatePurchasingTables1791000000340,
	CreateVendorProductTermTable1791000000345,
	AddGoodsReceiptLinePositiveCheck1791000000431
];

export {
	CreatePurchasingTables1791000000340,
	CreateVendorProductTermTable1791000000345,
	AddGoodsReceiptLinePositiveCheck1791000000431
};
