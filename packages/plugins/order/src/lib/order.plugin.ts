import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { cartCheckoutRegistry } from '@gauzy/plugin-cart';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { TaxPlugin } from '@gauzy/plugin-tax';
import { ALL_ORDER_ENTITIES } from './entities';
import { OrderModule } from './order.module';
import { OrderCheckoutHandler } from './checkout/order-checkout.handler';
import { ALL_ORDER_MIGRATIONS } from './database/order-migrations';
import { orderSchemaExtensions } from './graphql/schema-extensions';
import { orderResolvers } from './graphql';
import { ORDER_FEATURE_CONTRIBUTIONS, ORDER_SETTING_CONTRIBUTIONS } from './order.features';
import { ORDER_PERMISSION_CONTRIBUTIONS } from './order.permissions';

/**
 * The order plugin.
 *
 * The package owns the canonical order aggregate: its ten tables, its lifecycle, its totals, its
 * changes, its money ledger and its timeline. It contributes those tables through its own migration set,
 * which also adds the foreign key the cart set deliberately leaves off `commerce_cart.orderId` — the
 * set that creates a target is the set that constrains it.
 *
 * At bootstrap it registers itself as the cart's checkout handler. That is the whole of the coupling
 * between the two packages: the cart publishes where a checkout happens, this package implements it, and
 * neither imports the other's internals in the wrong direction.
 */
@Plugin({
	imports: [OrderModule],
	entities: ALL_ORDER_ENTITIES,
	migrations: ALL_ORDER_MIGRATIONS,
	permissions: ORDER_PERMISSION_CONTRIBUTIONS,
	features: ORDER_FEATURE_CONTRIBUTIONS,
	settings: ORDER_SETTING_CONTRIBUTIONS,
	extensions: {
		schema: orderSchemaExtensions,
		resolvers: orderResolvers
	},
	dependsOn: [PricingPlugin, TaxPlugin]
})
export class OrderPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	/** Whether the plugin narrates its lifecycle in the log. */
	private logEnabled = true;

	constructor(private readonly checkoutHandler: OrderCheckoutHandler) {}

	/**
	 * Called when the plugin is being initialized.
	 *
	 * Registering the checkout handler here rather than in a provider's constructor is deliberate: a
	 * module-level registry must be filled before the first request, and this hook is the earliest point
	 * at which the handler's own dependencies are resolved.
	 */
	onPluginBootstrap(): void | Promise<void> {
		cartCheckoutRegistry.register(this.checkoutHandler);

		if (this.logEnabled) {
			console.log(chalk.green(`${OrderPlugin.name} is being bootstrapped...`));
			console.log(chalk.green(`Registered the "order" checkout handler with the cart plugin.`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${OrderPlugin.name} is being destroyed...`));
		}
	}
}
