import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { ALL_CART_ENTITIES } from './entities';
import { CartModule } from './cart.module';
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
	imports: [CartModule],
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
