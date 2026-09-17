import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AddTaxCategoryForeignKeys1791000000150 } from './database/migrations/1791000000150-AddTaxCategoryForeignKeys';
import { CreateTaxTables1791000000140 } from './database/migrations/1791000000140-CreateTaxTables';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { TaxCategory } from './tax-category/tax-category.entity';
import { TaxRate } from './tax-rate/tax-rate.entity';
import { TaxModule } from './tax.module';
import { TAX_FEATURES } from './tax.features';
import { TAX_PERMISSIONS } from './tax.permissions';
import { TAX_SETTINGS } from './tax.settings';

/**
 * The tax capability.
 *
 * The package owns two tables and the resolution that reads them. It declares no dependency: a rate is
 * resolved from the category and the destination a caller already has, so the layer stands on the
 * platform's own kernel — the money rules, the rule engine and the tax ledger — and on nothing that
 * another plugin contributes. Installing it is what installs its schema, its routes, its permissions and
 * its schema extension.
 */
@Plugin({
	/**
	 * The plugin's own module, which carries its controllers, its services, its repositories and its
	 * resolvers.
	 */
	imports: [TaxModule],
	/**
	 * The entities the plugin owns. Each is registered with both ORMs by the module above; this list is
	 * what tells the platform which tables belong to the package.
	 */
	entities: [TaxCategory, TaxRate],
	/**
	 * The migrations of the set, in run order: the tables first, then the two foreign keys whose target
	 * the first migration creates.
	 */
	migrations: [CreateTaxTables1791000000140, AddTaxCategoryForeignKeys1791000000150],
	/**
	 * The permissions the package contributes to the platform role model.
	 */
	permissions: TAX_PERMISSIONS,
	/**
	 * The feature flags it contributes.
	 */
	features: TAX_FEATURES,
	/**
	 * The settings it reads.
	 */
	settings: TAX_SETTINGS,
	/**
	 * The GraphQL contribution: the SDL this package extends the platform schema with, and the resolvers
	 * behind the root fields it declares.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	},
	/**
	 * Nothing has to be loaded before this package: it is a peer of the other layer-one capabilities and
	 * reads only core tables.
	 */
	dependsOn: []
})
export class TaxPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${TaxPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${TaxPlugin.name} is being destroyed...`));
		}
	}
}
