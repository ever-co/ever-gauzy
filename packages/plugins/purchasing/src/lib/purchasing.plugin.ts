import * as chalk from 'chalk';
import { Type } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { migrations } from './database/migrations';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { ALL_PURCHASING_ENTITIES, PurchasingModule } from './purchasing.module';
import { PURCHASING_FEATURES } from './purchasing.features';
import { PURCHASING_PERMISSIONS } from './purchasing.permissions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * A receipt writes stock movements and a purchase-order line may name the bin its goods are put away
 * into, so the inventory ledger and the warehouse layout have to be present before the receiving
 * endpoints can do anything. Both capabilities are reached through injection tokens rather than by
 * importing their modules — that is what makes the dependency a load-order one rather than a
 * compile-time one.
 */
const PURCHASING_DEPENDS_ON: string[] = ['@gauzy/plugin-inventory', '@gauzy/plugin-warehouse'];

/**
 * Purchasing: what the organization buys, what arrives, and how the two are reconciled.
 *
 * Five tables, one lifecycle and one seam. The lifecycle is explicit because each of its edges has a
 * consequence outside the document — approving commits the money, sending is what starts counting the
 * goods as incoming, receiving is what moves stock — and the seam is the inventory capability, because
 * a receipt that adjusted a stock level itself would be a second writer of a number the ledger owns.
 *
 * The fifth table is the agreement rather than a document: `vendor_product_term` is the many-per-vendor
 * and many-per-product row a purchase line is priced and dated from, which is why a supplier's own
 * lead time is a default rather than the answer.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [PurchasingModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [...ALL_PURCHASING_ENTITIES],
	/**
	 * The migrations this plugin owns, in run order. The platform merges them into the connection's
	 * migration list before the connection is created, so they run in timestamp order with every other
	 * package's.
	 */
	migrations: [...migrations],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...PURCHASING_PERMISSIONS],
	/**
	 * The feature flag the plugin's endpoints are gated behind.
	 */
	features: [...PURCHASING_FEATURES],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: PURCHASING_DEPENDS_ON as unknown as Array<Type<any>>,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class PurchasingPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${PurchasingPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${PurchasingPlugin.name} is being destroyed...`));
		}
	}
}
