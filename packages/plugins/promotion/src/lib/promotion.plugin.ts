import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { PromotionModule } from './promotion.module';
import { PROMOTION_PERMISSIONS } from './promotion.permissions';
import { PROMOTION_FEATURES } from './promotion.features';
import { PROMOTION_SETTINGS } from './promotion.settings';
import { schemaExtensions } from './graphql/schema-extensions';
import { resolvers } from './graphql/resolvers';
import { CreatePromotionTables1791000000260 } from './migrations/1791000000260-CreatePromotionTables';
import { AddPromotionCheckConstraints1791000000433 } from './migrations/1791000000433-AddPromotionCheckConstraints';
import { ALL_PROMOTION_ENTITIES } from './promotion.entities';

/**
 * The declared prerequisite list, in the shape the published plugin metadata declares today.
 *
 * The framework widens this member to plugin ids (`Array<string>`) as part of the plugin-framework
 * workstream; while the published interface still types it as plugin classes, the declaration below
 * is narrowed through this alias so the values stay the package names the load order is resolved by.
 */
type PluginDependencies = NonNullable<Parameters<typeof Plugin>[0]['dependsOn']>;

/**
 * The promotion domain.
 *
 * What the plugin contributes is the whole of the offer machinery: campaigns and their budgets,
 * promotions and their actions, the codes that grant them, the usage ledger the limits are checked
 * against, and gift cards with their own balance ledger. What it deliberately does **not** contribute
 * is a condition model or a discount table — a promotion's eligibility is a set of `rule` rows and
 * the money it moves is a set of `adjustment` rows, both of which are kernel tables this plugin reads
 * and writes rather than duplicates.
 *
 * The package depends on pricing because a promotion discounts a price the pricing domain resolved,
 * and on nothing else: it is one layer above the kernel and below the cart and order domains, which
 * consume it through its service.
 */
@Plugin({
	imports: [PromotionModule],
	entities: ALL_PROMOTION_ENTITIES,
	migrations: [CreatePromotionTables1791000000260, AddPromotionCheckConstraints1791000000433],
	permissions: PROMOTION_PERMISSIONS,
	features: PROMOTION_FEATURES,
	settings: PROMOTION_SETTINGS,
	extensions: {
		schema: schemaExtensions,
		resolvers
	},
	/**
	 * Plugin ids that must be loaded first. The framework orders the configured plugin list by these
	 * ids, so a prerequisite's migrations are present in the connection before this package's set
	 * runs; declaring a dependency never enables a feature the other plugin gates.
	 */
	dependsOn: ['pricing'] as unknown as PluginDependencies
} as Parameters<typeof Plugin>[0])
export class PromotionPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// Additional logging for each lifecycle event is off by default, to keep the boot log readable.
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${PromotionPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${PromotionPlugin.name} is being destroyed...`));
		}
	}
}
