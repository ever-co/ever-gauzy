import * as chalk from 'chalk';
import { Type } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ENTITLEMENT_MIGRATIONS } from './database/migrations';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { ENTITLEMENT_FEATURES } from './entitlement.features';
import { EntitlementModule, ALL_ENTITLEMENT_ENTITIES } from './entitlement.module';
import { ENTITLEMENT_PERMISSIONS } from './entitlement.permissions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * A right is granted by an order line and is over a catalogue item, so both capabilities have to be
 * present before an entitlement can point at one: the foreign keys into `order`, `order_line`,
 * `product` and `product_variant` are created by this plugin's migration, and the grant path consumes
 * the order's events.
 */
const ENTITLEMENT_DEPENDS_ON: string[] = ['@gauzy/plugin-catalog', '@gauzy/plugin-order'];

/**
 * Entitlements, activations and licence keys.
 *
 * What a purchase grants and who is using it: the right itself, the devices and named seats that
 * occupy its slots, and the credentials it is delivered as. One package because an activation limit
 * and a licence key mean something only to the thing being sold, and because a tenant enables the
 * whole capability or none of it.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [EntitlementModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [...ALL_ENTITLEMENT_ENTITIES],
	/**
	 * The migrations this plugin owns. The platform merges them into the connection's migration list
	 * before the connection is created, so they run in timestamp order with every other package's.
	 */
	migrations: [...ENTITLEMENT_MIGRATIONS],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...ENTITLEMENT_PERMISSIONS],
	/**
	 * The feature flag the plugin's endpoints are gated behind. It defaults to off.
	 */
	features: [...ENTITLEMENT_FEATURES],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: ENTITLEMENT_DEPENDS_ON as unknown as Array<Type<any>>,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class EntitlementPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${EntitlementPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${EntitlementPlugin.name} is being destroyed...`));
		}
	}
}
