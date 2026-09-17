import * as chalk from 'chalk';
import { Type } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CreateReturnTables1791000000300 } from './database/migrations/1791000000300-CreateReturnTables';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { RETURNS_FEATURES } from './returns.features';
import { ReturnsModule, ALL_RETURNS_ENTITIES } from './returns.module';
import { RETURNS_PERMISSIONS } from './returns.permissions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * Returns are raised against a delivered order and settled with money, so the order and payment
 * capabilities have to be present before the endpoints can do anything: this plugin reads the
 * fulfilled quantities of an order and asks the payment capability to issue a refund.
 */
const RETURNS_DEPENDS_ON: string[] = ['@gauzy/plugin-order', '@gauzy/plugin-payment'];

/**
 * Returns, claims and exchanges.
 *
 * Three flows over one question — goods that were delivered and should not have been, or arrived
 * wrong — placed in one package because they share the reason codes, the numbering, the receiving
 * step and the stock decision, and because a tenant enables them together or not at all.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [ReturnsModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [...ALL_RETURNS_ENTITIES],
	/**
	 * The migrations this plugin owns. The platform merges them into the connection's migration list
	 * before the connection is created, so they run in timestamp order with every other package's.
	 */
	migrations: [CreateReturnTables1791000000300],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...RETURNS_PERMISSIONS],
	/**
	 * The feature flag the plugin's endpoints are gated behind.
	 */
	features: [...RETURNS_FEATURES],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: RETURNS_DEPENDS_ON as unknown as Array<Type<any>>,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class ReturnsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${ReturnsPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${ReturnsPlugin.name} is being destroyed...`));
		}
	}
}
