import {
	ID,
	ISearchFilter,
	ISearchRequest,
	ISearchResult,
	ISearchSort,
	SearchMatchMode
} from '@gauzy/contracts';

/**
 * Where a page sits in a result set.
 *
 * A search result is a page like any other on this platform, so it carries the same boundary
 * information a listing does and a client that can walk a list can walk a search. The cursors are
 * opaque and carry the offset they resume at, which is enough because a result set is ordered by
 * relevance and then by title — a total order, so two runs of the same query page identically.
 */
export interface ISearchPageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string | null;
	endCursor: string | null;
}

/**
 * One page of search results.
 */
export interface ISearchPage extends ISearchResult {
	pageInfo: ISearchPageInfo;
}

/**
 * A search as it arrives over either surface.
 *
 * The REST DTO and the GraphQL input are both rendered into this one shape, so the two surfaces
 * cannot drift: a request expressed over GraphQL and the same request expressed over REST reach the
 * same service with the same values, and a rule about what may be searched is written once.
 */
export interface ISearchRequestInput {
	/** The free-text query. */
	q?: string;
	/** Entity keys to search; empty means every entity the caller may see. */
	entities?: string[];
	/** How the terms are combined. */
	matchMode?: SearchMatchMode;
	/** Filter predicates, each naming a declared field. */
	filters?: ISearchFilter[];
	/** Declared field names whose values are counted in the response's facets. */
	facets?: string[];
	/** How the page is ordered. */
	sort?: ISearchSort;
	/** How many hits to skip. */
	skip?: number;
	/** How many hits to return. */
	take?: number;
	/** Restricts the result to one channel's documents. */
	channelId?: ID;
	/** Explicit organization scope; the caller's own organization is used when it is absent. */
	organizationId?: ID;
	/** Whether facet counts are computed. */
	withFacets?: boolean;
}

/**
 * A reindex as it arrives over either surface.
 */
export interface ISearchReindexInput {
	/** `ALL`, `ENTITY` or `CHANNEL`. */
	scope: string;
	entity?: string;
	channelId?: ID;
	ids?: ID[];
	since?: Date | string;
}

/**
 * Renders a request input into the terms every provider implements.
 *
 * @param input The input.
 * @returns The provider-facing request.
 * @throws Error when the input names neither text nor a filter, which is an unbounded listing rather
 * than a search and belongs on the resource's own endpoint.
 */
export function toSearchRequest(input: ISearchRequestInput): ISearchRequest {
	const q = String(input?.q ?? '').trim();
	const filters = (input?.filters ?? []).filter(Boolean);

	return {
		q,
		entities: input?.entities,
		matchMode: input?.matchMode,
		filters,
		facets: input?.withFacets === false ? [] : (input?.facets ?? []),
		sort: input?.sort,
		skip: input?.skip,
		take: input?.take,
		channelId: input?.channelId,
		organizationId: input?.organizationId
	};
}
