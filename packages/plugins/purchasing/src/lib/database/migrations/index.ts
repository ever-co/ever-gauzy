import { CreatePurchasingTables1791000000340 } from './1791000000340-CreatePurchasingTables';
import { CreateVendorProductTermTable1791000000345 } from './1791000000345-CreateVendorProductTermTable';

/**
 * Every migration this plugin owns, in run order.
 *
 * One array, spread into the plugin's `migrations` metadata, so the order a set runs in is readable
 * where the set is declared rather than inferred from file names alone: `CreatePurchasingTables` creates
 * the four documents, and `CreateVendorProductTermTable` adds the agreement they are priced from —
 * including the columns and the index the documents gained for it.
 */
export const migrations = [CreatePurchasingTables1791000000340, CreateVendorProductTermTable1791000000345];

export { CreatePurchasingTables1791000000340, CreateVendorProductTermTable1791000000345 };
