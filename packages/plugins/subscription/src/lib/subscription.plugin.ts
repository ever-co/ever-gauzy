import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CreateSubscriptionTables1791000000320 } from './database/migrations/1791000000320-CreateSubscriptionTables';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { SUBSCRIPTION_FEATURES } from './subscription.features';
import { SubscriptionModule, ALL_SUBSCRIPTION_ENTITIES } from './subscription.module';
import { SUBSCRIPTION_PERMISSIONS } from './subscription.permissions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * A plan is attached to a catalogue item and priced through the pricing pipeline, a cycle raises its
 * order through the ordinary checkout, and the renewal is charged against an instrument the payment
 * capability owns. Each of those is a capability this plugin cannot do without, so each is declared
 * rather than discovered at request time.
 */
const SUBSCRIPTION_DEPENDS_ON: string[] = [
	'@gauzy/plugin-catalog',
	'@gauzy/plugin-pricing',
	'@gauzy/plugin-order',
	'@gauzy/plugin-payment'
];

/**
 * Subscriptions and recurring billing.
 *
 * One package, because a plan, the agreement it produces, the lines each cycle bills and the record
 * of every cycle are one answer to one question — sell the same thing again on a schedule — and a
 * tenant enables them together or not at all.
 *
 * What this plugin does *not* own is the money: a cycle hands its recurring lines to the ordinary
 * order path, which prices, taxes, reserves and charges them, and every event it produces goes to
 * the platform outbox for whoever consumes it. Nothing here reads or writes another domain's tables.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [SubscriptionModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [...ALL_SUBSCRIPTION_ENTITIES],
	/**
	 * The migrations this plugin owns. The platform merges them into the connection's migration list
	 * before the connection is created, so they run in timestamp order with every other package's.
	 */
	migrations: [CreateSubscriptionTables1791000000320],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...SUBSCRIPTION_PERMISSIONS],
	/**
	 * The feature flag the plugin's endpoints are gated behind. It defaults to off.
	 */
	features: [...SUBSCRIPTION_FEATURES],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: SUBSCRIPTION_DEPENDS_ON,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class SubscriptionPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${SubscriptionPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${SubscriptionPlugin.name} is being destroyed...`));
		}
	}
}
