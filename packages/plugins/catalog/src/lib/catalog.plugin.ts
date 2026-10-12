import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CATALOG_FEATURES } from './catalog.features';
import { CATALOG_PERMISSIONS } from './catalog.permissions';
import { CatalogModule } from './catalog.module';
import { Collection } from './collection/collection.entity';
import { CollectionChannel } from './collection-channel/collection-channel.entity';
import { CollectionProduct } from './collection-product/collection-product.entity';
import { CollectionVariant } from './collection-variant/collection-variant.entity';
import { CreateCatalogTables1791000000100 } from './database/migrations/1791000000100-CreateCatalogTables';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { ProductChannel } from './product-channel/product-channel.entity';
import { ProductRelation } from './product-relation/product-relation.entity';
import { ProductVariantChannel } from './product-variant-channel/product-variant-channel.entity';
import { ProductVariantMedia } from './product-variant-media/product-variant-media.entity';
import { TagProductVariant } from './tag-product-variant/tag-product-variant.entity';

/**
 * The catalog plugin.
 *
 * It contributes the publication, collection, facet, gallery and relation tables, the migration that
 * creates them — including the closure table for the collection tree, which is created by that
 * migration and deliberately not declared as an entity — the permissions and feature flags it needs,
 * and its slice of the GraphQL schema.
 *
 * `dependsOn` is empty: every table the catalogue references belongs to the platform kernel or to the
 * product tables the platform already owns, so the catalogue is a layer-one peer of the pricing and
 * tax packages rather than a consumer of either.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [CatalogModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will register these entities for use within the
	 * application. `collection_closure` is not listed: the ORM maintains it for the collection tree and
	 * a class for it would let two writers disagree about its contents.
	 */
	entities: [
		Collection,
		CollectionProduct,
		CollectionVariant,
		CollectionChannel,
		ProductChannel,
		ProductVariantChannel,
		ProductRelation,
		ProductVariantMedia,
		TagProductVariant
	],
	/**
	 * The database migrations this plugin owns.
	 */
	migrations: [CreateCatalogTables1791000000100],
	/**
	 * The permissions this plugin contributes to the platform role model.
	 */
	permissions: CATALOG_PERMISSIONS,
	/**
	 * The feature flags this plugin contributes.
	 */
	features: CATALOG_FEATURES,
	/**
	 * The GraphQL schema extension and the resolvers that serve it.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	},
	/**
	 * Plugins that must be loaded before this one. The catalogue needs none: everything it references is
	 * a platform table rather than another plugin's.
	 */
	dependsOn: []
})
export class CatalogPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${CatalogPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${CatalogPlugin.name} is being destroyed...`));
		}
	}
}
