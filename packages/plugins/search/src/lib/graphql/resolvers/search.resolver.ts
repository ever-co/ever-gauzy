import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
	ID,
	ISearchFacet,
	ISearchIndexStatus,
	ISearchSuggestion,
	SearchMatchMode,
	SearchSortDirection
} from '@gauzy/contracts';
import {
	DEFAULT_CONNECTION_PAGE_SIZE,
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	MAX_CONNECTION_PAGE_SIZE,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SearchService, decodeCursor } from '../../services/search.service';
import { SearchPermissions } from '../../search.permissions';
import { ISearchPage, ISearchRequestInput } from '../../search.types';

/** One filter as the schema declares it. */
interface ISearchFilterArgs {
	attribute: string;
	operator: string;
	value?: unknown;
	entity?: string;
}

/** A search as the schema declares it. */
interface ISearchArgs {
	q?: string;
	entities?: string[];
	matchMode?: SearchMatchMode;
	filters?: ISearchFilterArgs[];
	facets?: string[];
	sort?: { attribute: string; direction?: SearchSortDirection };
	skip?: number;
	take?: number;
	channelId?: ID;
	organizationId?: ID;
}

/** A page as the schema declares it. */
interface IPageArgs {
	first?: number;
	after?: string;
	last?: number;
	before?: string;
}

/**
 * Search: the GraphQL root fields of the platform capability that finds anything a caller may see.
 *
 * The resolvers call the same service the REST surface calls, so a query expressed over GraphQL and
 * the same query expressed over REST travel through one implementation of every rule — the same
 * permission filter, the same facet predicate, the same re-read of each hit. Authorisation is
 * unchanged: `PermissionGuard` reads the caller's grants from the request context, exactly as it does
 * for a REST call, and the service removes an entity the caller may not read before the merge rather
 * than after it.
 *
 * **The guard chain is the controller's, in full.** `TenantPermissionGuard` used to be missing here
 * and on the definition resolver, and those two were the only surfaces on the branch without it —
 * their own REST counterpart carries all three (`search.controller.ts`). The two guards are not
 * interchangeable: `PermissionGuard` checks the caller's *role* grants and asserts nothing about the
 * tenant, while `TenantPermissionGuard` refuses a request with no resolved tenant outright, verifies
 * the tenant row itself, runs the separate *tenant*-level grant lookup that decides whether the tenant
 * was ever given the capability, and carries the super-administrator short circuit. Without it a
 * caller whose tenant was never granted search could run these fields although the identical REST
 * route refused them, and a super administrator authorised on `GET /api/search` was refused on the
 * GraphQL `search` field — a parity break in both directions on one capability.
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
@Resolver('SearchResult')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class SearchResolver {
	constructor(private readonly searchService: SearchService) {}

	/**
	 * Searches every entity the caller may see.
	 *
	 * @param input The search.
	 * @param page The page, in the shared cursor vocabulary.
	 * @returns One ranked, faceted page.
	 */
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Query('search')
	async search(@Args('input') input: ISearchArgs, @Args('page') page?: IPageArgs): Promise<ISearchPage> {
		return await this.searchService.search(this.toRequest(input, this.pageWindow(input, page)));
	}

	/**
	 * Completes what a caller has started typing.
	 *
	 * @param q The text to complete.
	 * @param entities The entities to complete over.
	 * @param limit How many suggestions to return.
	 * @param channelId The channel to complete inside.
	 * @returns The suggestions.
	 */
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Query('searchSuggest')
	async searchSuggest(
		@Args('q') q: string,
		@Args('entities') entities?: string[],
		@Args('limit') limit?: number,
		@Args('channelId') channelId?: ID
	): Promise<ISearchSuggestion[]> {
		return await this.searchService.suggest({ q, entities, channelId }, limit);
	}

	/**
	 * Breaks a filter set down by the values of the declared facet attributes.
	 *
	 * @param input The search, asked for its breakdown.
	 * @returns The facets.
	 */
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Query('searchFacets')
	async searchFacets(@Args('input') input: ISearchArgs): Promise<ISearchFacet[]> {
		return await this.searchService.facets({ ...this.toRequest(input), withFacets: true });
	}

	/**
	 * Reports how fresh each entity's index is.
	 *
	 * One status per entity is a page of rows, not an aggregation: `indexStatus` answers the whole
	 * permitted set and takes no window, so the page is cut here. A field that accepted a page and
	 * answered every row would leave a client walking a `pageInfo` nothing honours.
	 *
	 * @param entities The entities to report.
	 * @param page The page.
	 * @returns A page of statuses.
	 */
	@Permissions(SearchPermissions.SEARCH_VIEW)
	@Query('searchIndexStatus')
	async searchIndexStatus(
		@Args('entities') entities?: string[],
		@Args('page') page?: IConnectionPageSelection
	): Promise<GraphqlConnection<ISearchIndexStatus>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.searchService.indexStatus(entities);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Renders a schema input into the shape the service reads.
	 *
	 * @param input The schema input.
	 * @param window An explicit page window, when one was supplied.
	 * @returns The service input.
	 */
	private toRequest(input: ISearchArgs, window?: { skip: number; take: number }): ISearchRequestInput {
		return {
			q: input?.q,
			entities: input?.entities,
			matchMode: input?.matchMode,
			filters: (input?.filters ?? []).map((filter) => ({
				attribute: filter.attribute,
				operator: filter.operator as never,
				value: filter.value as never,
				entity: filter.entity
			})),
			facets: input?.facets,
			sort: input?.sort
				? { attribute: input.sort.attribute, direction: input.sort.direction ?? SearchSortDirection.DESC }
				: undefined,
			skip: window?.skip ?? input?.skip,
			take: window?.take ?? input?.take,
			channelId: input?.channelId,
			organizationId: input?.organizationId
		};
	}

	/**
	 * The page window a `PageInput` names.
	 *
	 * The size is clamped to the one the query protocol allows, which the search read was not: `take` came
	 * straight from the caller, so `first: 1000000` asked the index for a million documents in one request,
	 * and the default was this resolver's own 25 rather than the protocol's 20 — one request with two
	 * answers depending on which field answered it.
	 *
	 * The cursor is search's own, and it means "resume at this position" rather than "after the row this
	 * names": `SearchService` answers `pageInfo.endCursor` as the offset *past* its page, so decoding it and
	 * reading from there is the documented walk. That is a different convention from the connections', and it
	 * is stated here rather than left for a reader to infer from the arithmetic.
	 *
	 * @param input The search, whose own `skip`/`take` are the fallback.
	 * @param page The page selection.
	 * @returns The offset and the page size.
	 */
	private pageWindow(input: ISearchArgs, page?: IPageArgs): { skip: number; take: number } {
		const forward = page?.first !== undefined;
		const requested = Number((forward ? page?.first : page?.last) ?? input?.take ?? DEFAULT_CONNECTION_PAGE_SIZE);
		const take = Math.min(
			Math.max(Number.isFinite(requested) ? Math.trunc(requested) : DEFAULT_CONNECTION_PAGE_SIZE, 1),
			MAX_CONNECTION_PAGE_SIZE
		);
		const skip = decodeCursor(forward ? page?.after : page?.before) || Number(input?.skip ?? 0);

		return { skip: Math.max(0, skip), take };
	}
}
