import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { MarketplaceModule } from './marketplace.module';
import { MARKETPLACE_PERMISSIONS } from './marketplace.permissions';
import { MARKETPLACE_FEATURES } from './marketplace.features';
import { MARKETPLACE_SETTINGS } from './marketplace.settings';
import { CreateMarketplaceTables1791000000380 } from './database/migrations/1791000000380-CreateMarketplaceTables';
import { AddSellerPayoutAccountForeignKeys1791000000420 } from './database/migrations/1791000000420-AddSellerPayoutAccountForeignKeys';
import { AddMarketplaceCheckConstraints1791000000434 } from './database/migrations/1791000000434-AddMarketplaceCheckConstraints';
import { Seller } from './seller/seller.entity';
import { SellerOffering } from './seller-offering/seller-offering.entity';
import { SellerTransaction } from './seller-transaction/seller-transaction.entity';
import { SellerPayout } from './seller-payout/seller-payout.entity';
import { SellerPayoutLine } from './seller-payout-line/seller-payout-line.entity';
import { SellerSettlement } from './seller-settlement/seller-settlement.entity';
import { schemaExtensions } from './graphql/schema-extensions';
import { resolvers } from './graphql/resolvers';

/**
 * The marketplace plugin.
 *
 * Six tables, one API surface and one GraphQL surface. The plugin owns the seller account and its
 * lifecycle, the offering and its publication, the commission, the per-seller split of an order's
 * money, the payout instruction and the settlement report — and it owns **no funds**: every movement
 * of buyer money is executed by a regulated payment provider, and what the platform records here is
 * what each seller is owed, what it instructed, and what the provider reported back.
 */
@Plugin({
	/**
	 * The plugin's own module, which is the whole marketplace as far as the platform is concerned.
	 */
	imports: [MarketplaceModule],
	/**
	 * Every entity this plugin maps. Each one is declared exactly once, here and in the package's public
	 * surface: a table that an ORM is not told about is a table that does not exist at runtime.
	 */
	entities: [Seller, SellerOffering, SellerTransaction, SellerPayout, SellerPayoutLine, SellerSettlement],
	/**
	 * The migrations this plugin owns. Ordering follows each migration's own timestamp, never the order
	 * plugins happen to be listed in — this one runs after the order and payment sets, because the
	 * ledger it stores refers to their rows. The third states the rules a seller's money carries: a rate
	 * is a fraction, a payout's instructed amount is its net less the fee and the reserve, and a
	 * settlement's net is its gross less the commission and the fee.
	 */
	migrations: [
		CreateMarketplaceTables1791000000380,
		AddSellerPayoutAccountForeignKeys1791000000420,
		AddMarketplaceCheckConstraints1791000000434
	],
	/**
	 * What the platform unions into its permission catalogue, so a role can be granted a marketplace
	 * permission exactly like a built-in one.
	 */
	permissions: MARKETPLACE_PERMISSIONS,
	/**
	 * The feature flags, all off by default: third-party selling changes who may be paid and how much,
	 * so it is enabled deliberately and with commission terms agreed first.
	 */
	features: MARKETPLACE_FEATURES,
	/**
	 * The settings the marketplace reads. Declarations only; resolution goes through the platform's own
	 * settings store, at the scope each value names.
	 */
	settings: MARKETPLACE_SETTINGS,
	/**
	 * The packages this plugin needs loaded first. The split prices and splits lines that belong to the
	 * order, payment, catalogue and pricing packages, so it cannot function without them. The values are
	 * package names rather than classes because that is what an operator reads in a diagnostic; the
	 * decorator's metadata type declares classes, hence the cast.
	 */
	dependsOn: [
		'@gauzy/plugin-order',
		'@gauzy/plugin-payment',
		'@gauzy/plugin-catalog',
		'@gauzy/plugin-pricing'
	] as any,
	/**
	 * GraphQL parity with the REST surface: the same resources, the same permissions, the same field
	 * selection.
	 *
	 * The schema document and the resolvers are one contribution and are declared together, because
	 * neither half is usable alone: a root field the schema does not declare is never served, however
	 * well its resolver is written, and a root field with no resolver answers null without an error
	 * anywhere. `schemaExtensions` declares every type and root field the marketplace serves, and
	 * `resolvers` — the same list the plugin module provides — supplies their behaviour and the guards
	 * that protect them.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class MarketplacePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	/** Additional logging is on by default, because a plugin that fails to load silently is the hard case. */
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${MarketplacePlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${MarketplacePlugin.name} is being destroyed...`));
		}
	}
}
