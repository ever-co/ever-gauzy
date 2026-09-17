import * as chalk from 'chalk';
import { Type } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { SEARCH_FEATURE_CONTRIBUTIONS } from './search.features';
import { SearchPluginModule } from './search.module';
import { SEARCH_PERMISSION_CONTRIBUTIONS } from './search.permissions';
import { SEARCH_SETTING_CONTRIBUTIONS } from './search.settings';
import { SeedSearchIndexDefinitions1791000000400 } from './database/migrations/1791000000400-SeedSearchIndexDefinitions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * None. Global search is a platform capability rather than a domain one: it reaches entities through
 * the declarations registered with it, and a declaration for an entity whose package is not loaded is
 * skipped rather than fatal. Declaring a dependency here would make the search package a load-bearing
 * prerequisite of every domain it indexes, which is the arrangement the kernel tables exist to avoid.
 */
const SEARCH_DEPENDS_ON: string[] = [];

/**
 * Global search: one index over every domain, and the endpoints that read it.
 *
 * The tables live in the kernel and this package owns the behaviour, which is a deliberate split
 * rather than an accident of layering. `search_document` and `search_index_definition` belong to core
 * because every domain uses them — contacts, invoices, expenses, products, orders, projects, tasks,
 * employees and documents alike — so an index a single domain owned would make every other domain
 * depend on that domain's package. What is left for this package is everything that is *done* with
 * them: the declarative index definitions, the indexing pipeline fed by the platform's event
 * deliveries, the provider registry with its built-in database provider and its optional engine seam,
 * the reindex sweep and the search, suggestion, facet and index endpoints.
 *
 * The consequence is stated where it matters and repeated here: **an installation with this package
 * absent still has both tables**, unused and breaking nothing, and an installation that loads it
 * without configuring an engine passes the whole search acceptance suite, because the built-in
 * database provider is registered unconditionally and is what answers.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [SearchPluginModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 *
	 * It is **empty on purpose.** The two tables this package searches over — `search_document` and
	 * `search_index_definition` — are core tables with core entities, declared in the kernel's own
	 * search module and created by the kernel's own migration. Declaring them here as well would give
	 * one table two owners: the ORM would see the same table mapped twice, the entity array would carry
	 * it twice, and the package that happened to load last would decide its columns.
	 */
	entities: [],
	/**
	 * The migrations this plugin owns. The platform merges them into the connection's migration list
	 * before the connection is created, so they run in timestamp order with every other package's.
	 *
	 * There is one, and it creates no table: the tables are the kernel's. It seeds the rows that say
	 * which entities are searchable and how much each of their fields counts, idempotently, so a fresh
	 * installation can be inspected before a single document has been written.
	 */
	migrations: [SeedSearchIndexDefinitions1791000000400],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...SEARCH_PERMISSION_CONTRIBUTIONS],
	/**
	 * The feature flags the plugin's endpoints are gated behind.
	 */
	features: [...SEARCH_FEATURE_CONTRIBUTIONS],
	/**
	 * The settings the plugin reads, so an operator can override any of them per tenant, per
	 * organization or per channel without a code change.
	 */
	settings: [...SEARCH_SETTING_CONTRIBUTIONS],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: SEARCH_DEPENDS_ON as unknown as Array<Type<any>>,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema. The root operation types belong to the
	 * kernel, so the document extends `Query` and `Mutation` and never declares them.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class SearchPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${SearchPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${SearchPlugin.name} is being destroyed...`));
		}
	}
}
