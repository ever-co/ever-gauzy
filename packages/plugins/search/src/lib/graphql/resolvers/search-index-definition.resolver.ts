import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, ISearchIndexField, SearchFieldKind, SearchReindexScope } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, SearchIndexDefinition, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SearchIndexDefinitionService } from '../../services/search-index-definition.service';
import { SearchReindexService, ISearchReindexRun } from '../../services/search-reindex.service';
import { SearchPermissions } from '../../search.permissions';
import { ISearchReindexInput } from '../../search.types';
import { toUserError } from '../wire';
/** How an operator re-weights a definition, as the schema declares it. */
interface IDefinitionUpdateArgs {
	label?: string;
	fields?: Array<{
		name: string;
		kind: SearchFieldKind;
		weight?: string;
		searchable?: boolean;
		filterable?: boolean;
		facetable?: boolean;
		source?: string;
	}>;
	titleTemplate?: string;
	bodyTemplate?: string;
	keywordFields?: string[];
	defaultWeight?: string;
	sourceUpdatedAtField?: string;
	isActive?: boolean;
}

/**
 * The index-definition side of the search domain.
 *
 * A declaration is *shipped* rather than authored: the package that owns an entity states which of its
 * fields the index holds and where each value is read from, because a field that does not exist on the
 * entity produces an index that silently never matches. What an operator owns is the weights, the
 * templates, the promoted fields and whether the entity is indexed at all — and that is what these
 * fields change. There is deliberately no `createSearchIndexDefinition`: an authored declaration is a
 * second, weaker copy of a fact the code already states.
 *
 * The rebuild fields live here rather than beside the query fields because a rebuild is a write: it
 * changes the index for everybody, and it carries the operator grant that says so.
 *
 * **The chain is the controller's, and the tenant guard is first because it was missing.**
 * `SearchController` carries `@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)`; this
 * class carried only the last two, so over GraphQL a caller that stated a `Tenant-Id` header naming a
 * tenant other than the one its own credential was issued for was never compared against it.
 * `TenantBaseGuard` is what performs that comparison for an operation (`tenant-base.guard.ts`,
 * `canActivateGraphqlOperation`), and a resolver that does not run it is a resolver the same header can
 * be pointed at another tenant through. That matters here more than beside the read fields, because the
 * rebuild and drop mutations below change the index for every caller of the tenant they name. The guard
 * is stated first for the same reason it is first on the route: a caller that states the wrong tenant is
 * refused as a tenancy problem before its grants are consulted.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('SearchIndexDefinition')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class SearchIndexDefinitionResolver {
	constructor(
		private readonly definitionService: SearchIndexDefinitionService,
		private readonly reindexService: SearchReindexService
	) {}

	/**
	 * Lists the index definitions the caller may see.
	 *
	 * @param entity Narrows the list to one entity.
	 * @returns The definitions.
	 */
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW)
	@Query('searchIndexDefinitions')
	async searchIndexDefinitions(@Args('entity') entity?: string): Promise<SearchIndexDefinition[]> {
		return await this.definitionService.list(entity);
	}

	/**
	 * Reads one index definition.
	 *
	 * @param id The definition.
	 * @returns The definition, or null when it is not the caller's.
	 */
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW)
	@Query('searchIndexDefinition')
	async searchIndexDefinition(@Args('id') id: ID): Promise<SearchIndexDefinition | null> {
		try {
			return await this.definitionService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Re-weights or deactivates a definition.
	 *
	 * @param id The definition.
	 * @param input The fields to change.
	 * @returns The payload, with the definition or the reason it was refused.
	 */
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT)
	@Mutation('updateSearchIndexDefinition')
	async updateSearchIndexDefinition(@Args('id') id: ID, @Args('input') input: IDefinitionUpdateArgs) {
		try {
			const searchIndexDefinition = await this.definitionService.updateDefinition(id, {
				label: input?.label,
				fields: input?.fields as unknown as ISearchIndexField[],
				titleTemplate: input?.titleTemplate,
				bodyTemplate: input?.bodyTemplate,
				keywordFields: input?.keywordFields,
				defaultWeight: input?.defaultWeight === undefined ? undefined : Number(input.defaultWeight),
				sourceUpdatedAtField: input?.sourceUpdatedAtField,
				isActive: input?.isActive
			});

			return { searchIndexDefinition, userErrors: [] };
		} catch (error) {
			return { searchIndexDefinition: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes a definition an operator authored.
	 *
	 * @param id The definition.
	 * @returns The payload, with the reason a shipped definition was refused.
	 */
	@Permissions(SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT)
	@Mutation('deleteSearchIndexDefinition')
	async deleteSearchIndexDefinition(@Args('id') id: ID) {
		try {
			const result = await this.definitionService.removeDefinition(id);

			return { id: result.id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rebuilds one entity's index.
	 *
	 * @param entity The entity to rebuild.
	 * @param input The remainder of the request.
	 * @returns The payload, carrying what the sweep did.
	 */
	@Permissions(SearchPermissions.SEARCH_REINDEX)
	@Mutation('reindexEntity')
	async reindexEntity(@Args('entity') entity: string, @Args('input') input?: ISearchReindexInput) {
		return await this.reindex({ ...(input ?? {}), scope: SearchReindexScope.ENTITY, entity });
	}

	/**
	 * Rebuilds every index, or every index of one channel.
	 *
	 * @param input The request.
	 * @returns The payload, carrying what each sweep did.
	 */
	@Permissions(SearchPermissions.SEARCH_REINDEX)
	@Mutation('reindexAll')
	async reindexAll(@Args('input') input?: ISearchReindexInput) {
		const scope = input?.channelId ? SearchReindexScope.CHANNEL : SearchReindexScope.ALL;

		return await this.reindex({ ...(input ?? {}), scope });
	}

	/**
	 * Drops the index of an entity, or of one channel.
	 *
	 * @param entity The entity to drop.
	 * @param channelId The channel to drop.
	 * @returns The payload, carrying how many documents were dropped.
	 */
	@Permissions(SearchPermissions.SEARCH_REINDEX)
	@Mutation('dropSearchIndex')
	async dropSearchIndex(@Args('entity') entity?: string, @Args('channelId') channelId?: ID) {
		try {
			const result = await this.reindexService.drop(entity, channelId);

			return { deletedCount: result.deletedCount, userErrors: [] };
		} catch (error) {
			return { deletedCount: 0, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Runs a rebuild and renders its outcome as a payload.
	 *
	 * @param input The request.
	 * @returns The payload.
	 */
	private async reindex(input: ISearchReindexInput) {
		try {
			const request = {
				scope: input.scope as never,
				entity: input.entity,
				channelId: input.channelId,
				ids: input.ids,
				since: input.since ? new Date(input.since) : undefined
			};
			const plan = await this.reindexService.plan(request);
			const runs: ISearchReindexRun[] = await this.reindexService.run(request);

			return { ...plan, runs, userErrors: [] };
		} catch (error) {
			return { entity: input?.entity ?? null, queued: false, estimatedCount: 0, runs: [], userErrors: [toUserError(error)] };
		}
	}
}
