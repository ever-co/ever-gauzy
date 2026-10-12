import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
	ID,
	ISearchFacet,
	ISearchHit,
	ISearchIndexRegistration,
	ISearchIndexStatus,
	ISearchRequest,
	ISearchResult,
	ISearchSuggestion,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { SearchIndexerService } from './search-indexer.service';
import { SearchReindexService } from './search-reindex.service';
import { buildAttributes, normalisedWeight, SearchSourceRow } from './search-document.builder';
import { ISearchPage, ISearchPageInfo, ISearchRequestInput, toSearchRequest } from '../search.types';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';

/** One hit's live rendering, read from the entity that owns it. */
interface IMaterialisedHit {
	hit: ISearchHit;
	row?: SearchSourceRow;
}

/**
 * The read half of search: one request, every entity the caller may see, one ranked page.
 *
 * Two rules shape everything here, and both exist because the index is a projection rather than a
 * system of record.
 *
 * **Permission filtering happens before the merge, per entity type.** A declaration names the grant a
 * caller needs in order to see a hit of its entity, and an entity the caller may not read is removed
 * from the query rather than filtered out of its answer. `total` therefore counts what the caller may
 * see and never reveals how many rows were withheld — a total that moved when a permission was
 * missing would be the leak the filter was meant to prevent.
 *
 * **A hit is re-read from the entity that owns it.** `search_document` is never authoritative: the
 * page asks the source rows for the ids it matched, drops a hit whose row is gone, and takes the
 * values it renders from those rows. Nothing here returns a price, a stock level, a balance, a status
 * or a permission that came out of the index, which is what makes dropping the table and rebuilding
 * it a maintenance operation rather than a data loss.
 */
@Injectable()
export class SearchService {
	private readonly logger = new Logger(SearchService.name);

	constructor(
		private readonly indexRegistry: SearchIndexRegistry,
		private readonly providerRegistry: SearchProviderRegistry,
		private readonly indexer: SearchIndexerService,
		private readonly reindexService: SearchReindexService
	) {}

	/**
	 * How fresh each entity's index is.
	 *
	 * The report reads the index and the source together, so it distinguishes "the index holds nothing"
	 * from "the index is behind": the first is an indexed count of zero, the second a pending count
	 * that is not zero, and they call for different actions.
	 *
	 * @param entities The entities to report; every entity the caller may search when none is named.
	 * @returns One status per entity.
	 */
	async indexStatus(entities?: string[]): Promise<ISearchIndexStatus[]> {
		const scope = entities?.length ? entities.filter((entity) => this.permittedEntities({ entities: [entity] }).length > 0) : this.permittedEntities();

		return await this.reindexService.status(scope);
	}

	/**
	 * Runs a search and returns one ranked, faceted page.
	 *
	 * @param request The request, from either surface.
	 * @returns The page.
	 * @throws BadRequestException when the request carries neither text nor a filter.
	 */
	async search(request: ISearchRequestInput): Promise<ISearchPage> {
		const entities = this.permittedEntities(request);
		const take = this.pageSize(request?.take);
		const skip = this.offset(request?.skip);
		const organizationId = this.scopedOrganizationId(request);
		const providerRequest = toSearchRequest({ ...request, organizationId, skip, take });

		if (!this.isBounded(providerRequest)) {
			throw new BadRequestException(
				'SEARCH_QUERY_INVALID: a search must carry a query or a filter. An unbounded listing is what ' +
					'the resource endpoints are for.'
			);
		}

		if (entities.length === 0) {
			return this.emptyPage(skip, take);
		}

		const { provider } = await this.providerRegistry.resolve();

		let result: ISearchResult;

		try {
			result = await provider.query(providerRequest, entities);
		} catch (error) {
			this.logger.error(`The search provider "${provider.key}" refused the query: ${describe(error)}`);
			throw error;
		}

		const items = await this.materialise(result.items ?? [], {
			tenantId: RequestContext.currentTenantId(),
			organizationId: organizationId ?? null
		});

		return {
			items,
			total: Number(result.total ?? items.length),
			facets: result.facets ?? [],
			searchedEntities: result.searchedEntities ?? entities,
			pageInfo: this.pageInfo(skip, take, result.total ?? 0)
		};
	}

	/**
	 * Type-ahead over the same index and the same permissions.
	 *
	 * @param request The request.
	 * @param limit How many suggestions the caller asked for.
	 * @returns The suggestions.
	 */
	async suggest(request: ISearchRequestInput, limit?: number): Promise<ISearchSuggestion[]> {
		const entities = this.permittedEntities(request);

		if (entities.length === 0) {
			return [];
		}

		const providerRequest = toSearchRequest({ ...request, organizationId: this.scopedOrganizationId(request) });

		if (!this.isBounded(providerRequest)) {
			throw new BadRequestException(
				'SEARCH_QUERY_INVALID: a suggestion request must carry the text it is completing.'
			);
		}

		const { provider } = await this.providerRegistry.resolve();

		return await provider.suggest(providerRequest, entities, this.suggestLimit(limit));
	}

	/**
	 * The values of the requested facet attributes, counted on the page's own predicate.
	 *
	 * The facets come from the same call that produces the page, so a facet can never describe a
	 * different result set than the one it is shown beside — which is the only property that makes a
	 * facet count worth reading.
	 *
	 * @param request The request.
	 * @returns The facets.
	 */
	async facets(request: ISearchRequestInput): Promise<ISearchFacet[]> {
		const page = await this.search({ ...request, withFacets: true });

		return page.facets;
	}

	/**
	 * The entity keys the caller may search, of the ones registered.
	 *
	 * An entity is in scope when a declaration exists for it, the declaration is active, the
	 * installation actually has the entity's table, and the caller holds the grant the declaration
	 * names. A request that names entities narrows this set and can never widen it.
	 *
	 * @param request The request.
	 * @returns The entity keys.
	 */
	permittedEntities(request?: ISearchRequestInput): string[] {
		const requested = (request?.entities ?? []).map((entity) => String(entity)).filter(Boolean);
		const wanted = requested.length > 0 ? new Set(requested) : null;

		return this.indexRegistry
			.getAll()
			.filter((definition) => (wanted ? wanted.has(definition.entity) : true))
			.filter((definition) => definition.isActive !== false)
			.filter((definition) => Boolean(this.indexer.entityKeyOf(definition.entity)))
			.filter((definition) => this.mayRead(definition))
			.map((definition) => definition.entity);
	}

	/**
	 * The organization a request is answered inside, taken from the credential rather than from the
	 * request.
	 *
	 * `organizationId` is a declared, optional member of both public request shapes, and it used to
	 * be the *only* organization predicate the read carried: a caller in organization X could ask for
	 * `organizationId=<Y>` and receive the indexed titles, bodies, keywords and highlight fragments of
	 * an organization it has no membership in. Nothing checked the membership, because nothing
	 * compared the stated organization with the one the credential carries.
	 *
	 * The credential's organization is `user.lastOrganizationId`, which the JWT strategy sets only
	 * after verifying the user belongs to it — so it is the membership check, and a stated
	 * organization is treated as a narrowing that has to agree with it. A tenant super administrator
	 * is the documented exception, exactly as it is for `TenantPermissionGuard`: the role is
	 * tenant-scoped, the tenant predicate still applies, and an operator moving between the tenant's
	 * organizations is the workflow the role exists for.
	 *
	 * A caller with no organization at all is left unnarrowed rather than refused: the tenant
	 * predicate still bounds the read, and a tenant-wide search is a legitimate answer for a caller
	 * who has not selected an organization. What is not legitimate is *choosing* another one.
	 *
	 * @param request The request, as it arrived.
	 * @returns The organization the read is scoped to, or `undefined` when the caller has none.
	 * @throws ForbiddenException when the request names an organization the caller may not read.
	 */
	private scopedOrganizationId(request?: ISearchRequestInput): ID | undefined {
		const credential = RequestContext.currentOrganizationId() ?? undefined;
		const stated = request?.organizationId ? String(request.organizationId) : undefined;

		if (!stated) {
			return credential;
		}

		if (credential && stated === String(credential)) {
			return credential;
		}

		if (RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return stated as ID;
		}

		throw new ForbiddenException(
			'SEARCH_ORGANIZATION_FORBIDDEN: a search is answered inside the organization the caller is ' +
				'authenticated for. Naming another one is refused rather than honoured, because the index ' +
				'holds every organization of the tenant in one table.'
		);
	}

	/**
	 * Whether the caller holds the grant a declaration names.
	 *
	 * A declaration that names no grant is refused rather than admitted: an entity nobody can be
	 * authorised against would be an entity every caller could read.
	 *
	 * @param definition The declaration.
	 * @returns True when the caller may see a hit of this entity.
	 */
	private mayRead(definition: ISearchIndexRegistration): boolean {
		const permission = String(definition.permission ?? '').trim();

		if (!permission) {
			this.logger.warn(
				`The index definition for "${definition.entity}" names no permission, so the entity is not ` +
					'searchable. A hit nobody can be authorised against is a hit everybody can read.'
			);

			return false;
		}

		try {
			return RequestContext.hasPermission(permission as PermissionsEnum);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Re-reads the matched rows and renders each hit from them.
	 *
	 * The index supplied the match: which rows, in which order, and the fragment that matched. What a
	 * client renders comes from the entity itself, so a price that changed a second ago is the price
	 * that is current, and a row that has since been deleted disappears from the page instead of
	 * being returned as a skeleton nothing can be done with.
	 *
	 * A source that cannot be read at all is reported and the hits are kept: a transient read failure
	 * must not empty a page the index answered correctly. The alternative — dropping hits because the
	 * database blinked — turns a blip into a wrong answer.
	 *
	 * The re-read carries the caller's own tenant and organization. `ISourceRowQuery` accepts both,
	 * and the ids alone are not a scope: an index that returned a document it should not have — or a
	 * caller reaching the service outside a request — would otherwise have the *source* rows read back
	 * unscoped too, which is the one place the index's non-authoritative design stops protecting
	 * anything.
	 *
	 * @param hits The hits the provider matched.
	 * @param scope The tenant and organization the rows are re-read inside; the caller's own when it
	 * states none.
	 * @returns The hits that still exist, rendered from their rows.
	 */
	async materialise(
		hits: ISearchHit[],
		scope?: { tenantId?: ID | null; organizationId?: ID | null }
	): Promise<ISearchHit[]> {
		const tenantId = scope?.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope?.organizationId ?? null;

		const grouped = new Map<string, ISearchHit[]>();

		for (const hit of hits ?? []) {
			const entity = String(hit.entity ?? '');

			if (!entity) {
				continue;
			}

			grouped.set(entity, [...(grouped.get(entity) ?? []), hit]);
		}

		const rendered: IMaterialisedHit[] = [];

		for (const [entity, group] of grouped) {
			const definition = this.indexRegistry.get(entity);

			if (!definition) {
				// A document whose declaration is gone describes an entity nothing indexes any more, and
				// there is nothing to re-read it from.
				continue;
			}

			let rows: SearchSourceRow[];

			try {
				rows = await this.indexer.readSourceRows(definition, {
					ids: group.map((hit) => hit.entityId),
					tenantId,
					organizationId
				});
			} catch (error) {
				this.logger.warn(
					`The "${entity}" source rows could not be re-read, so the hits are returned as the index ` +
						`holds them: ${describe(error)}`
				);
				rendered.push(...group.map((hit) => ({ hit })));
				continue;
			}

			const byId = new Map(rows.map((row) => [String(row.id), row]));

			for (const hit of group) {
				const row = byId.get(String(hit.entityId));

				if (row) {
					rendered.push({ hit, row });
				}
			}
		}

		return rendered.map(({ hit, row }) => {
			if (!row) {
				return hit;
			}

			const definition = this.indexRegistry.get(String(hit.entity));

			return {
				...hit,
				title: hit.title,
				attributes: definition
					? buildAttributes(definition, row, normalisedWeight(definition, row))
					: hit.attributes
			};
		});
	}

	/**
	 * Whether a request is bounded.
	 *
	 * A search with no text and no filter is not a search: it is an unbounded listing of everything
	 * the caller may see, and the resource endpoints answer that question with the filter vocabulary
	 * their resource actually has.
	 *
	 * @param request The provider-facing request.
	 * @returns True when the request carries text or at least one filter.
	 */
	private isBounded(request: ISearchRequest): boolean {
		return String(request?.q ?? '').trim().length > 0 || (request?.filters?.length ?? 0) > 0;
	}

	/**
	 * The requested page size, bounded by the configured limit.
	 *
	 * @param take What the request asked for.
	 * @returns The page size.
	 */
	private pageSize(take?: number): number {
		const requested = Number(take);
		const limit = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.resultPageSizeLimit) || 100);

		if (!Number.isFinite(requested) || requested <= 0) {
			return limit;
		}

		return Math.min(Math.floor(requested), limit);
	}

	/**
	 * The requested offset.
	 *
	 * @param skip What the request asked for.
	 * @returns The offset.
	 */
	private offset(skip?: number): number {
		const requested = Number(skip);

		return Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 0;
	}

	/**
	 * The requested suggestion count, bounded by the configured limit.
	 *
	 * @param limit What the request asked for.
	 * @returns The suggestion count.
	 */
	private suggestLimit(limit?: number): number {
		const configured = Math.max(1, Number(SEARCH_SETTING_DEFAULTS.suggestLimit) || 10);
		const requested = Number(limit);

		if (!Number.isFinite(requested) || requested <= 0) {
			return configured;
		}

		return Math.min(Math.floor(requested), configured);
	}

	/**
	 * The boundary information of a page.
	 *
	 * @param skip The offset the page started at.
	 * @param take The page size.
	 * @param total The number of hits that matched.
	 * @returns The page information.
	 */
	private pageInfo(skip: number, take: number, total: number): ISearchPageInfo {
		const start = Math.max(0, skip);
		const end = start + take;

		return {
			hasNextPage: end < total,
			hasPreviousPage: start > 0,
			startCursor: total > 0 ? encodeCursor(start) : null,
			endCursor: total > 0 ? encodeCursor(Math.min(end, total)) : null
		};
	}

	/**
	 * A page with nothing in it, for a caller who may search nothing.
	 *
	 * It is a page and not an error: a caller with no searchable entity is a caller whose grants do
	 * not include any of them, which is a legitimate state and not a malformed request.
	 *
	 * @param skip The offset.
	 * @param take The page size.
	 * @returns The empty page.
	 */
	private emptyPage(skip: number, take: number): ISearchPage {
		return {
			items: [],
			total: 0,
			facets: [],
			searchedEntities: [],
			pageInfo: this.pageInfo(skip, take, 0)
		};
	}
}

/**
 * Encodes the offset a cursor resumes at.
 *
 * It is deliberately opaque: a client stores it and hands it back, and the codec can change without
 * breaking one. It carries the offset rather than the sort value because a result set is ordered by
 * relevance and then by title — a total order — so an offset is a stable position in it.
 *
 * @param offset The offset.
 * @returns The cursor.
 */
export function encodeCursor(offset: number): string {
	return Buffer.from(String(Math.max(0, Math.floor(offset))), 'utf8').toString('base64');
}

/**
 * Decodes a cursor a client handed back.
 *
 * @param cursor The cursor.
 * @returns The offset it carries; zero when it carries none.
 */
export function decodeCursor(cursor?: string): number {
	if (!cursor) {
		return 0;
	}

	try {
		const offset = Number.parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);

		return Number.isFinite(offset) && offset >= 0 ? offset : 0;
	} catch (error) {
		return 0;
	}
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
