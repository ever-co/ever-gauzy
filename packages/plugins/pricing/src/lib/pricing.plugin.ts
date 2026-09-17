import * as chalk from 'chalk';
import {
	GauzyCorePlugin as Plugin,
	IOnPluginBootstrap,
	IOnPluginDestroy,
	PluginSettingContribution
} from '@gauzy/plugin';
import { ExchangeRate } from './exchange-rate/exchange-rate.entity';
import { PriceList } from './price-list/price-list.entity';
import { PricePreference } from './price-preference/price-preference.entity';
import { ProductPrice } from './product-price/product-price.entity';
import { PricingModule } from './pricing.module';
import { PRICING_FEATURES } from './pricing.features';
import { PRICING_PERMISSIONS } from './pricing.permissions';
import { schemaExtensions } from './graphql/schema-extensions';
import { resolvers } from './graphql/resolvers';
import {
	AddPriceComputationColumns1791000000135,
	AddPriceListForeignKeys1791000000130,
	CreatePricingTables1791000000120
} from './database/migrations';

/**
 * The settings this plugin reads.
 *
 * A declaration is metadata, not storage: the value always resolves through the platform settings
 * store, so an operator overrides any of these per tenant or per organization without a code change.
 * Only the two decisions that belong to an installation rather than to a price row are declared.
 */
const PRICING_SETTINGS: PluginSettingContribution[] = [
	{
		key: 'pricing.priceCacheTtlSeconds',
		type: 'number',
		default: 300,
		scope: 'TENANT',
		description:
			'How long a resolved price may be cached for a context before it is resolved again. A write to a price or a price list invalidates the entries it affects immediately; this bounds the damage of an invalidation that is lost.'
	},
	{
		key: 'pricing.legacyRetailPriceFallback',
		type: 'boolean',
		default: true,
		scope: 'ORGANIZATION',
		description:
			'Whether a variant with no price row resolves to the legacy variant retail price. Turning it off makes an unpriced variant resolve to nothing instead, which is the stricter setting.'
	}
];

/**
 * The pricing plugin.
 *
 * Pricing is a layer-1 peer: it owns four tables and reads two core ones (`product_variant_price` for
 * the legacy fallback and `organization_contact` for the party a price list may be bound to), and it
 * requires no other plugin to be loaded first — which is why `dependsOn` is empty rather than naming
 * a plugin that would only be needed by a caller further up the stack.
 *
 * Every table it owns is created by the migration set declared here, and every permission and feature
 * it adds is a contribution the platform unions in at bootstrap, so an installation that does not load
 * the plugin is never aware of it.
 */
@Plugin({
	/**
	 * The plugin's own module: the four aggregates, their controllers and their GraphQL resolvers.
	 */
	imports: [PricingModule],
	/**
	 * The tables this plugin owns. Each one is registered with both ORMs and reaches the API through
	 * the services of `PricingModule`.
	 */
	entities: [PriceList, ProductPrice, PricePreference, ExchangeRate],
	/**
	 * The migrations that create this plugin's schema. They are ordered by their own timestamps
	 * against every other migration in the installation, so the tables exist before the API serves a
	 * request whether or not any other plugin is installed.
	 */
	migrations: [
		CreatePricingTables1791000000120,
		AddPriceListForeignKeys1791000000130,
		AddPriceComputationColumns1791000000135
	],
	/**
	 * The pricing capabilities a role may be granted.
	 */
	permissions: PRICING_PERMISSIONS,
	/**
	 * The flags that decide whether the module and its two authoring shapes exist for a tenant.
	 */
	features: PRICING_FEATURES,
	/**
	 * The installation-wide decisions this plugin reads.
	 */
	settings: PRICING_SETTINGS,
	/**
	 * The schema this plugin adds to the platform GraphQL endpoint, and the resolvers that answer it.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	},
	/**
	 * Pricing is a layer-1 peer and genuinely requires no other plugin: the tables it references are
	 * kernel tables, and a capability that needs pricing declares the dependency on its own side.
	 */
	dependsOn: []
})
export class PricingPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${PricingPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${PricingPlugin.name} is being destroyed...`));
		}
	}
}
