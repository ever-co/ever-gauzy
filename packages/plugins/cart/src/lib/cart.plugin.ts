import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { ALL_CART_ENTITIES } from './entities';
import { CartModule } from './cart.module';
import { CartMaintenanceModule } from './maintenance/cart-maintenance.module';
import { ALL_CART_MIGRATIONS } from './database/cart-migrations';
import { cartSchemaExtensions } from './graphql/schema-extensions';
import { cartResolvers } from './graphql';
import { CART_FEATURE_CONTRIBUTIONS, CART_SETTING_CONTRIBUTIONS } from './cart.features';
import { CART_PERMISSION_CONTRIBUTIONS } from './cart.permissions';

/**
 * The cart plugin.
 *
 * The package owns the cart family and the checkout session, contributes their tables through its own
 * migration set, and declares the four permissions and the one feature flag a tenant needs to use
 * them. It depends on the catalogue (a line is only addable for a published variant), on pricing (a
 * line's price is resolved, never authored) and on inventory (checkout takes reservations that this
 * package does not own), and on nothing else — in particular not on the order package, which depends
 * on this one.
 */
@Plugin({
	// `CartMaintenanceModule` carries the expiry and abandonment sweeps. It is imported here rather
	// than left to the application because the two windows it acts on — `expiresAt` and
	// `cart.abandonedAfterHours` — are this package's own promises: the column was refreshed on every
	// recalculation and acted on by nothing, and the setting was declared and read by nothing, so an
	// installation that simply installs the plugin has to get the sweeps that make them true.
	//
	// 🛑 **Conditional for the same reason the kernel's own sweep is.** Registering a queue where no
	// `SchedulerModule.forRoot()` exists is not a degraded sweep — it is a boot that fails on `Worker
	// requires a connection`, which is the path every single-container and development setup runs on.
	// With no queue root the cart capability is complete and unchanged; what an installation gives up
	// is the two passes, so a cart there stays `ACTIVE` past its expiry exactly as it did before, and
	// the checkout ladder is still what refuses it.
	imports: [CartModule, ...(isSchedulerQueueRootEnabled() ? [CartMaintenanceModule] : [])],
	entities: ALL_CART_ENTITIES,
	migrations: ALL_CART_MIGRATIONS,
	permissions: CART_PERMISSION_CONTRIBUTIONS,
	features: CART_FEATURE_CONTRIBUTIONS,
	settings: CART_SETTING_CONTRIBUTIONS,
	extensions: {
		schema: cartSchemaExtensions,
		resolvers: cartResolvers
	},
	dependsOn: [CatalogPlugin, PricingPlugin, InventoryPlugin]
})
export class CartPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	/** Whether the plugin narrates its lifecycle in the log. */
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${CartPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${CartPlugin.name} is being destroyed...`));
		}
	}
}
