import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { OrderPlugin } from '@gauzy/plugin-order';
import { ALL_FULFILLMENT_ENTITIES } from './entities';
import { FulfillmentModule } from './fulfillment.module';
import { ALL_FULFILLMENT_MIGRATIONS } from './database/fulfillment-migrations';
import { fulfillmentSchemaExtensions } from './graphql/schema-extensions';
import { fulfillmentResolvers } from './graphql';
import { FULFILLMENT_FEATURE_CONTRIBUTIONS, FULFILLMENT_SETTING_CONTRIBUTIONS } from './fulfillment.features';
import { FULFILLMENT_PERMISSION_CONTRIBUTIONS } from './fulfillment.permissions';

/**
 * The fulfilment plugin.
 *
 * The package owns how a sold thing gets to the buyer: the profiles that decide whether a variant ships
 * at all, the options a buyer chooses between, and the shipments themselves. Its migration set runs
 * after the order set — and adds the foreign keys that set deliberately leaves off, because a set
 * constrains what it creates and the fulfilment set is the one that creates `shipping_option`.
 *
 * It depends on the order package (a fulfilment is against an order, and it maintains that order's line
 * counters) and on the inventory package (the reservations it consumes and the movements it writes
 * through). The feature flag defaults off: fulfilment implies a carrier or a shipping price list, and a
 * tenant that ships nothing should not be handed the tables.
 */
@Plugin({
	imports: [FulfillmentModule],
	entities: ALL_FULFILLMENT_ENTITIES,
	migrations: ALL_FULFILLMENT_MIGRATIONS,
	permissions: FULFILLMENT_PERMISSION_CONTRIBUTIONS,
	features: FULFILLMENT_FEATURE_CONTRIBUTIONS,
	settings: FULFILLMENT_SETTING_CONTRIBUTIONS,
	extensions: {
		schema: fulfillmentSchemaExtensions,
		resolvers: fulfillmentResolvers
	},
	dependsOn: [OrderPlugin, InventoryPlugin]
})
export class FulfillmentPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	/** Whether the plugin narrates its lifecycle in the log. */
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${FulfillmentPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${FulfillmentPlugin.name} is being destroyed...`));
		}
	}
}
