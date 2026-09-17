import { Module } from '@nestjs/common';
import { EventOutboxModule, FeatureModule, RolePermissionModule, SearchModule } from '@gauzy/core';
import { SearchController } from './search.controller';
import { SearchIndexConsumer } from './search-index.consumer';
import { DatabaseSearchProvider } from './providers/database-search.provider';
import { SearchProviderRegistry } from './providers/search-provider.registry';
import { SearchIndexRegistry } from './registry/search-index.registry';
import { SearchIndexDefinitionService } from './services/search-index-definition.service';
import { SearchIndexerService } from './services/search-indexer.service';
import { SearchReindexService } from './services/search-reindex.service';
import { SearchService } from './services/search.service';
import { SearchIndexDefinitionResolver } from './graphql/resolvers/search-index-definition.resolver';
import { SearchResolver } from './graphql/resolvers/search.resolver';

/**
 * The search plugin's Nest wiring.
 *
 * Four imports, each of which is load-bearing rather than conventional.
 *
 * - `SearchModule` is the **kernel's** module, not this package's, and it is imported rather than
 *   re-declared: the two tables it owns — `search_document` and `search_index_definition` — are core
 *   tables, because the index has to cover contacts, invoices, expenses, products, orders, projects,
 *   tasks, employees and documents alike, and an index one domain owned would make every other domain
 *   depend on that domain's package. Importing it is what makes the repositories injectable here.
 * - `RolePermissionModule` is required because every route on the controller carries
 *   `TenantPermissionGuard` and `PermissionGuard`, and a guard is a provider of the module that
 *   declares the handler it protects. Importing it in a parent module would not help: Nest imports are
 *   not inherited downwards, and the omission is a boot failure rather than a missing check.
 * - `FeatureModule` for the same reason, for the `FeatureFlagGuard` on the controller.
 * - `EventOutboxModule` is what makes the index self-maintaining. The consumer is registered against
 *   the platform's delivery registry, so an event that changes a searchable row is delivered to the
 *   index once, with the delivery recorded before the work is done — which is what makes a redelivery
 *   a no-op rather than a duplicate.
 *
 * The provider that is deliberately *absent* is the external engine. It is bound to
 * `SEARCH_PROVIDERS`, a token nothing in this module provides, and `SearchProviderRegistry` injects it
 * with `@Optional()`. So an installation with only the built-in database provider boots, answers and
 * indexes, and a package that ships an engine adds one binding without this module changing — which is
 * the whole reason the built-in provider exists.
 *
 * Every provider is named individually rather than spread from a shared array. A spread is invisible to
 * a static reader of this file — and to the platform's own composition pass, which unions the exports
 * of every plugin module to decide what a resolver may inject — so a service reached through one would
 * be a service a resolver cannot see.
 */
@Module({
	controllers: [SearchController],
	imports: [SearchModule, RolePermissionModule, FeatureModule, EventOutboxModule],
	providers: [
		// The declarations and the providers.
		SearchIndexRegistry,
		SearchProviderRegistry,
		DatabaseSearchProvider,
		// The pipeline and the two read models.
		SearchIndexerService,
		SearchReindexService,
		SearchIndexDefinitionService,
		SearchService,
		SearchIndexConsumer,
		// The resolvers are providers here because they inject the same services the REST controller
		// does; the plugin hands the composition pass the same classes through `extensions.resolvers`,
		// so there is one implementation per rule rather than one per surface.
		SearchResolver,
		SearchIndexDefinitionResolver
	],
	exports: [
		// The resolvers are hosted by the platform's composition module, so a service they inject has to
		// be exported here or the boot fails on an unresolved dependency.
		SearchService,
		SearchIndexerService,
		SearchReindexService,
		SearchIndexDefinitionService,
		SearchIndexRegistry,
		SearchProviderRegistry
	]
})
export class SearchPluginModule {}
