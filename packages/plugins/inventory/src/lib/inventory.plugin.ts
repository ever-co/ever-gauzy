import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { InventoryModule } from './inventory.module';
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
import {
	inventorySchemaExtensions,
	StockMovementResolver,
	StockReservationResolver,
	StockTransferResolver,
	StockAlertResolver,
	StockAdjustmentResolver,
	StockCountResolver,
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
 */
const pluginMetadata = {
	imports: [InventoryModule],
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
	migrations: [CreateInventoryTables1791000000160],
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
			StockAlertResolver,
			StockAdjustmentResolver,
			StockCountResolver,
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
