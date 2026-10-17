import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { PaymentModule, ALL_PAYMENT_ENTITIES } from './payment.module';
import { PAYMENT_PERMISSIONS } from './payment.permissions';
import { PAYMENT_FEATURES } from './payment.features';
import { PAYMENT_SETTINGS } from './payment.settings';
import { schemaExtensions } from './graphql/schema-extensions';
import { resolvers } from './graphql/resolvers';
import { ALL_PAYMENT_MIGRATIONS } from './migrations';

/**
 * The declared prerequisite list, in the shape the published plugin metadata declares today.
 *
 * The framework widens this member to plugin ids (`Array<string>`) as part of the plugin-framework
 * workstream; while the published interface still types it as plugin classes, the declaration below
 * is narrowed through this alias so the values stay the package names the load order is resolved by.
 */
type PluginDependencies = NonNullable<Parameters<typeof Plugin>[0]['dependsOn']>;

/**
 * The payment domain.
 *
 * What this package contributes is the whole of the provider lifecycle around a payment: the
 * registry of providers, the collection that groups the attempts for one order or cart, the sessions
 * themselves, the append-only captures, the refunds with their governed reasons and the lines each of
 * them paid back, and the log of the callbacks the providers send back. What it deliberately does
 * **not** contribute is a second
 * `payment` table: a payment is a payment whichever document it settles, so the core row is extended
 * and read, and the four lifecycle amounts on it are maintained here in the same transaction as the
 * capture or the refund that moved them.
 *
 * Two properties of the domain shape this file. **Nothing here is gated by a new feature flag** —
 * `FEATURE_PAYMENT` already exists in the platform catalogue and is reused, and the inbound callback
 * route is never gated at all, because a flag that could hide it would leave a provider's retries
 * failing against a surface that no longer exists. And **no route accepts card data**: the platform
 * stores a provider-issued token, the saved-instrument tables are core, and a body carrying a card
 * member is refused rather than dropped.
 *
 * The package declares `order` as its prerequisite because a collection settles an order and the
 * reconciliation reads the order rows against what was collected.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [PaymentModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will register these entities for use within the
	 * application. The core `payment` entity is not listed here: it is mapped by the kernel, and this
	 * package reaches it through its repository instead of declaring it a second time.
	 */
	entities: ALL_PAYMENT_ENTITIES,
	/**
	 * The database migrations this plugin owns, in run order. The first creates the seven tables of
	 * the domain, the second creates `refund_line` — the lines a refund paid back, which used to be an
	 * array inside the refund's metadata — and the third constrains the columns this domain owns on
	 * the core tables, which exist only once the core set has run.
	 */
	migrations: ALL_PAYMENT_MIGRATIONS,
	/**
	 * The permissions this plugin contributes to the platform role model.
	 */
	permissions: PAYMENT_PERMISSIONS,
	/**
	 * The feature flags this plugin contributes: none, deliberately. `FEATURE_PAYMENT` is reused.
	 */
	features: PAYMENT_FEATURES,
	/**
	 * The settings this plugin reads, with the defaults an installation starts from.
	 */
	settings: PAYMENT_SETTINGS,
	/**
	 * The GraphQL schema extension and the resolvers that serve it.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	},
	/**
	 * Plugin ids that must be loaded first. The framework orders the configured plugin list by these
	 * ids, so a prerequisite's migrations are present in the connection before this package's set
	 * runs; declaring a dependency never enables a feature the other plugin gates.
	 */
	dependsOn: ['order'] as unknown as PluginDependencies
} as Parameters<typeof Plugin>[0])
export class PaymentPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// Additional logging for each lifecycle event is off by default, to keep the boot log readable.
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${PaymentPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${PaymentPlugin.name} is being destroyed...`));
		}
	}
}
