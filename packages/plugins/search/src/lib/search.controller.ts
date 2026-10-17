import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { ID, ISearchIndexStatus, ISearchReindexResult, ISearchSuggestion } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	SearchIndexDefinition,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SearchFeatures } from './search.features';
import { SearchPermissions } from './search.permissions';
import { SearchService } from './services/search.service';
import { SearchReindexService, ISearchReindexRun } from './services/search-reindex.service';
import { SearchIndexDefinitionService } from './services/search-index-definition.service';
import { ISearchPage } from './search.types';
import {
	DropSearchIndexQueryDTO,
	SearchFacetQueryDTO,
	SearchIndexDefinitionQueryDTO,
	SearchIndexStatusQueryDTO,
	SearchQueryDTO,
	SearchReindexDTO,
	SearchSuggestQueryDTO,
	UpdateSearchIndexDefinitionDTO
} from './dto';

/**
 * Global search: one place to find anything the caller may see.
 *
 * The surface is a read model and an operator console, not a resource: `search_document` is a
 * projection and has no CRUD of its own, and an index definition is declared by the package that owns
 * the entity rather than authored by a caller. So there is no `CrudController` here and no `/admin`
 * or `/storefront` split — the second surface the platform publishes is GraphQL, and it is served by
 * the same services this controller calls.
 *
 * Every route carries its own grant. Reading a result set, rebuilding an index and re-weighting a
 * declaration are three different authorities, and an operator who holds one of them does not thereby
 * hold the others.
 */
@ApiTags('Search')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(SearchFeatures.SEARCH)
@Permissions(SearchPermissions.SEARCH_VIEW)
@Controller()
export class SearchController {
	constructor(
		private readonly searchService: SearchService,
		private readonly reindexService: SearchReindexService,
		private readonly definitionService: SearchIndexDefinitionService
	) {}

	/**
	 * Searches every entity the caller may see.
	 *
	 * @param query The search.
	 * @returns One ranked, faceted page.
	 */
	@ApiOperation({ summary: 'Search every indexed entity the caller may see' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The page of hits.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'SEARCH_QUERY_INVALID: no query and no filter.' })
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Get('/search')
	@UseValidationPipe({ transform: true, whitelist: true })
	async search(@Query() query: SearchQueryDTO): Promise<ISearchPage> {
		return await this.searchService.search(query);
	}

	/**
	 * Completes what a caller has started typing.
	 *
	 * @param query The text to complete.
	 * @returns The suggestions.
	 */
	@ApiOperation({ summary: 'Type-ahead over the indexed entities' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The suggestions.' })
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Get('/search/suggest')
	@UseValidationPipe({ transform: true, whitelist: true })
	async suggest(@Query() query: SearchSuggestQueryDTO): Promise<ISearchSuggestion[]> {
		return await this.searchService.suggest(
			{ q: query.q, entities: query.entities, channelId: query.channelId },
			query.limit
		);
	}

	/**
	 * Breaks a filter set down by the values of the declared facet attributes.
	 *
	 * The counts come from the same predicate as the page, so a facet always describes the result set
	 * it is shown beside.
	 *
	 * The route is served under `/search/facets`, where the other eight routes of this controller
	 * live. It used to be registered as a bare `/facets`, which put an un-namespaced top-level noun on
	 * the shared API root — the controller has an empty base path, so every route states its own — and
	 * a client reading this surface had to learn that eight of nine are under `search` and one is not.
	 * The original path is kept alongside the new one rather than replaced, because a published client
	 * may already be calling it.
	 *
	 * @param query The search, asked for its breakdown.
	 * @returns The facets.
	 */
	@ApiOperation({ summary: 'Facet value counts for a filter set' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The facets.' })
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Get(['/search/facets', '/facets'])
	@UseValidationPipe({ transform: true, whitelist: true })
	async facets(@Query() query: SearchFacetQueryDTO) {
		return { items: await this.searchService.facets(query) };
	}

	/**
	 * Lists which entity fields are indexed, with their weights.
	 *
	 * @param query The list filters.
	 * @returns The definitions.
	 */
	@ApiOperation({ summary: 'List the search index definitions' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The definitions.' })
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW)
	@Get('/search/index-definitions')
	@UseValidationPipe({ transform: true, whitelist: true })
	async indexDefinitions(
		@Query() query: SearchIndexDefinitionQueryDTO
	): Promise<{ items: SearchIndexDefinition[]; total: number }> {
		const items = await this.definitionService.list(query.entity);

		return {
			items: query.isActive === undefined ? items : items.filter((item) => Boolean(item.isActive) === query.isActive),
			total: items.length
		};
	}

	/**
	 * Reads one index definition.
	 *
	 * @param id The definition.
	 * @returns The definition.
	 */
	@ApiOperation({ summary: 'Read one search index definition' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The definition.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such definition is the caller\'s.' })
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW)
	@Get('/search/index-definitions/:id')
	async indexDefinition(@Param('id', UUIDValidationPipe) id: ID): Promise<SearchIndexDefinition> {
		return await this.definitionService.findOneScoped(id);
	}

	/**
	 * Re-weights a definition, or turns it off.
	 *
	 * @param id The definition.
	 * @param entity The fields to change.
	 * @returns The updated definition.
	 */
	@ApiOperation({ summary: 'Re-weight or deactivate a search index definition' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The definition was updated.' })
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/search/index-definitions/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateIndexDefinition(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSearchIndexDefinitionDTO
	): Promise<SearchIndexDefinition> {
		return await this.definitionService.updateDefinition(id, entity as any);
	}

	/**
	 * Removes a definition an operator authored.
	 *
	 * A shipped definition is refused: an operator who may re-weight a declaration must not be able to
	 * remove an entity from every search in the tenant, and deactivating it achieves the same thing
	 * without losing the documents.
	 *
	 * @param id The definition.
	 * @returns What was removed.
	 */
	@ApiOperation({ summary: 'Remove a search index definition an operator authored' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The definition was removed.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The definition is shipped and cannot be deleted.' })
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT)
	@Delete('/search/index-definitions/:id')
	async deleteIndexDefinition(@Param('id', UUIDValidationPipe) id: ID): Promise<{ id: ID; deleted: boolean }> {
		return await this.definitionService.removeDefinition(id);
	}

	/**
	 * Rebuilds the index.
	 *
	 * @param entity What to rebuild.
	 * @returns What the run accepts, with an estimate of the work.
	 */
	@ApiOperation({ summary: 'Rebuild the search index, in full or incrementally' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The rebuild was accepted and has run.' })
	@Permissions(SearchPermissions.SEARCH_REINDEX)
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('/search/reindex')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reindex(
		@Body() entity: SearchReindexDTO
	): Promise<ISearchReindexResult & { runs: ISearchReindexRun[] }> {
		const request = {
			scope: entity.scope,
			entity: entity.entity,
			channelId: entity.channelId,
			ids: entity.ids,
			since: entity.since ? new Date(entity.since) : undefined
		};
		const plan = await this.reindexService.plan(request);

		// The sweep runs to completion before the response: a rebuild that answered 202 and then failed
		// silently would leave an operator believing an index exists that does not. A long rebuild is
		// what the durable-operation runtime is for, and this route is where it would be adopted.
		const runs = await this.reindexService.run(request);

		return { ...plan, runs };
	}

	/**
	 * Reports how fresh each entity's index is.
	 *
	 * @param query The entities to report.
	 * @returns One status per entity.
	 */
	@ApiOperation({ summary: 'Index freshness and document counts' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The statuses.' })
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Get('/search/index-status')
	@UseValidationPipe({ transform: true, whitelist: true })
	async indexStatus(
		@Query() query: SearchIndexStatusQueryDTO
	): Promise<{ items: ISearchIndexStatus[]; total: number }> {
		const items = await this.reindexService.status(query.entities);

		return { items, total: items.length };
	}

	/**
	 * Drops the index of an entity, or of one channel.
	 *
	 * The rows are soft-deleted and the next rebuild revives them, so this is a cheap way to make a
	 * search answer nothing while a rebuild runs rather than a way to lose the index.
	 *
	 * @param query What to drop.
	 * @returns How many documents were dropped.
	 */
	@ApiOperation({ summary: 'Drop the index of an entity or of one channel' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The documents were dropped.' })
	@Permissions(SearchPermissions.SEARCH_REINDEX)
	@Delete('/search/index')
	@UseValidationPipe({ transform: true, whitelist: true })
	async dropIndex(@Query() query: DropSearchIndexQueryDTO): Promise<{ deletedCount: number }> {
		return await this.reindexService.drop(query.entity, query.channelId);
	}
}
