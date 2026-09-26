import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { InventoryModule } from './inventory.module';
import { InventoryMaintenanceModule } from './inventory-maintenance.module';
import { INVENTORY_FEATURES } from './inventory.features';
import { INVENTORY_PERMISSIONS } from './inventory.permissions';
import { INVENTORY_SETTINGS } from './inventory.settings';
import { StockMovement } from './stock-movement/stock-movement.entity';
import { StockReservation } from './stock-reservation/stock-reservation.entity';
import { StockTransfer } from './stock-transfer/stock-transfer.entity';
import { StockTransferLine } from './stock-transfer-line/stock-transfer-line.entity';
import { StockAlert } from './stock-alert/stock-alert.entity';
import { ChannelWarehouse } from './channel-warehouse/channel-warehouse.entity';
import { StockAdjustment } from './stock-adjustment/stock-adjustment.entity';
import { StockCount } from './stock-count/stock-count.entity';
import { StockCountLine } from './stock-count-line/stock-count-line.entity';
import { CreateInventoryTables1791000000160 } from './database/migrations/1791000000160-CreateInventoryTables';
import { BackfillStockRowScope1791000000405 } from './database/migrations/1791000000405-BackfillStockRowScope';
import { AddWarehouseSellerColumn1791000000436 } from './database/migrations/1791000000436-AddWarehouseSellerColumn';
import {
	inventorySchemaExtensions,
	StockMovementResolver,
	StockReservationResolver,
	StockTransferResolver,
	StockTransferLineResolver,
	StockAlertResolver,
	StockAdjustmentResolver,
	StockCountResolver,
	StockCountLineResolver,
	ChannelWarehouseResolver,
	StockLevelResolver
} from './graphql';

/**
 * The inventory plugin’s declaration.
 *
 * It is declared once as a value rather than inline so the same object can be asserted in a test and
 * read by the plugin status surface, and so the entity list, the migration set and the contributed
 * catalogue entries have one home each.
 *
 * `dependsOn` names the packages this one cannot function without. The catalog package is required
 * because a stock level is addressed by a product and a variant, and a movement names the variant it
 * changed; without it there is nothing to hold.
 *
 * **The maintenance module is imported behind the queue-root predicate**, exactly as the platform's
 * own retry-key sweep and outbox dispatch pass are. It carries the schedule that releases holds whose
 * expiry has passed — the sweep that was written and never called, so a cart hold taken for thirty
 * minutes stayed `ACTIVE` for ever and its quantity stayed subtracted from what may be sold. The
 * jobs travel on a queue, a queue needs a BullMQ root, and registering a worker where there is no
 * root is a boot failure rather than a degraded sweep; an installation with no queue therefore keeps
 * the whole reservation kernel and simply has no sweep, which is the same trade every other
 * maintenance module on this platform makes.
 */
const pluginMetadata = {
	imports: [InventoryModule, ...(isSchedulerQueueRootEnabled() ? [InventoryMaintenanceModule] : [])],
	entities: [
		StockMovement,
		StockReservation,
		StockTransfer,
		StockTransferLine,
		StockAlert,
		ChannelWarehouse,
		StockAdjustment,
		StockCount,
		StockCountLine
	],
	migrations: [
		CreateInventoryTables1791000000160,
		BackfillStockRowScope1791000000405,
		AddWarehouseSellerColumn1791000000436
	],
	permissions: INVENTORY_PERMISSIONS,
	features: INVENTORY_FEATURES,
	settings: INVENTORY_SETTINGS,
	extensions: {
		schema: inventorySchemaExtensions,
		resolvers: [
			StockLevelResolver,
			StockMovementResolver,
			StockReservationResolver,
			StockTransferResolver,
			StockTransferLineResolver,
			StockAlertResolver,
			StockAdjustmentResolver,
			StockCountResolver,
			StockCountLineResolver,
			ChannelWarehouseResolver
		]
	},
	dependsOn: ['@gauzy/plugin-catalog']
};

@Plugin(pluginMetadata)
export class InventoryPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${InventoryPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${InventoryPlugin.name} is being destroyed...`));
		}
	}
}
