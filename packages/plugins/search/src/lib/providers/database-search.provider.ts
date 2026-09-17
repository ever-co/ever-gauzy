import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { In, IsNull, SelectQueryBuilder } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import {
	ID,
	ISearchDocument,
	ISearchFacet,
	ISearchFilter,
	ISearchHit,
	ISearchIndexField,
	ISearchIndexRegistration,
	ISearchProvider,
	ISearchProviderHealth,
	ISearchRequest,
	ISearchResult,
	ISearchSuggestion,
	SearchFieldKind,
	SearchFilterOperator,
	SearchMatchMode,
	SearchSortDirection
} from '@gauzy/contracts';
import { RequestContext, SearchDocument, TypeOrmSearchDocumentRepository } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';

/** The dialect family a query is written for. */
type SearchDialect = 'postgres' | 'mysql' | 'sqlite';

/** The most values one facet reports. */
const FACET_VALUE_LIMIT = 50;

/** The key the document's own normalised weight is stored under inside its attribute map. */
const WEIGHT_ATTRIBUTE = '_weight';

/**
 * Everything one query needs, resolved once and shared by the page, the count and every facet.
 *
 * The facet queries are built from the same object as the page deliberately: a facet counted against a
 * different predicate than the one the page was selected by is a facet that describes another search.
 */
interface ISearchQueryContext {
	request: ISearchRequest;
	entities: string[];
	tenantId: ID | null;
	organizationId: ID | null;
	matchMode: SearchMatchMode;
	terms: string[];
	/** False on a dialect whose own full-text capability is unavailable, so the portable path is used. */
	useFullText: boolean;
	/** False on a dialect whose JSON path extraction is unavailable, so documents rank by weight alone. */
	useJsonPath: boolean;
}

/**
 * The built-in provider: the index the platform always has.
 *
 * It answers from `search_document` and it is portable by construction. Where a dialect has its own
 * full-text capability the provider uses it — a text-search vector on Postgres, a full-text match on
 * MySQL — and everywhere else it falls back to a token match over the document title, body and
 * promoted keywords, so the same query, the same filters and the same facets work on SQLite in a
 * developer's checkout and on Postgres in production.
 *
 * Two properties are not negotiable here. **The caller's permitted entity set is an input**, not a
 * post-filter, so permission filtering happens before the merge and a total never reveals how many rows
 * were filtered. And **the index is never authoritative**: a hit carries an entity type and an id, and
 * the attributes it returns are display values a listing renders, never a price, a stock level, a
 * balance, a status or a permission that anything computes with.
 *
 * Where a backend genuinely cannot do something, the provider says so rather than inventing an answer.
 * A facet whose values the dialect cannot extract is reported as an empty list, and ranking that falls
 * back to the document weight is the documented behaviour of that path rather than a relevance score
 * the backend did not compute.
 */
@Injectable()
export class DatabaseSearchProvider implements ISearchProvider {
	/** The provider key. `database` is the built-in one; a definition with no engine key resolves here. */
	readonly key = 'database';

	/** The built-in provider is not an external engine, and it is never reported as one. */
	readonly external = false;

	private readonly logger = new Logger(DatabaseSearchProvider.name);

	/** Capabilities of the live dialect that a failed query proved unusable. */
	private readonly degraded = new Set<string>();

	constructor(
		private readonly typeOrmSearchDocumentRepository: TypeOrmSearchDocumentRepository,
		private readonly indexRegistry: SearchIndexRegistry
	) {}

	/* --------------------------------------------------------------------------------------------
	 * Writing
	 * ------------------------------------------------------------------------------------------ */

	/**
	 * Writes or replaces documents.
	 *
	 * The write is keyed by `(tenant, entity, entityId, engine)`, which is the whole reason indexing the
	 * same row twice is an update rather than a duplicate: the outbox delivers at least once, and a
	 * consumer that needs no bookkeeping of its own is the point of the key. A document that was
	 * removed and is indexed again is revived rather than inserted twice, because the partial unique
	 * index treats a soft-deleted row as absent.
	 *
	 * @param documents The documents to write.
	 * @returns How many documents were written.
	 */
	async index(documents: ISearchDocument[]): Promise<number> {
		const rows = (documents ?? []).filter(Boolean);

		if (rows.length === 0) {
			return 0;
		}

		const repository = this.typeOrmSearchDocumentRepository;
		let written = 0;

		for (const group of this.groupByDocumentKey(rows)) {
			const entityIds = group.documents.map((document) => String(document.entityId));

			const existing = await repository.find({
				where: {
					tenantId: group.tenantId ?? IsNull(),
					entity: group.entity,
					entityId: In(entityIds),
					engineKey: group.engineKey ? group.engineKey : IsNull()
				},
				withDeleted: true
			});

			const byEntityId = new Map<string, any>(existing.map((row: any) => [String(row.entityId), row]));
			const toSave: any[] = [];

			for (const document of group.documents) {
				const row = byEntityId.get(String(document.entityId)) ?? repository.create();

				row.tenantId = document.tenantId ?? group.tenantId ?? null;
				row.organizationId = document.organizationId ?? null;
				row.entity = group.entity;
				row.entityId = document.entityId;
				row.title = document.title ?? '';
				row.body = document.body ?? null;
				row.keywords = document.keywords ?? null;
				row.attributes = document.attributes ?? null;
				row.sourceUpdatedAt = document.sourceUpdatedAt ?? null;
				row.indexedAt = document.indexedAt ?? new Date();
				row.engineKey = group.engineKey ?? null;
				row.definitionVersion = document.definitionVersion ?? 1;
				// A document the index removed earlier is revived by re-indexing its source, so the row is
				// restored rather than left behind the soft-delete filter while a second row is inserted.
				row.deletedAt = null;

				toSave.push(row);
			}

			const saved = await repository.save(toSave);
			written += Array.isArray(saved) ? saved.length : toSave.length;
		}

		return written;
	}

	/**
	 * Removes documents by entity and id.
	 *
	 * The row is soft-deleted: the index is a projection and a rebuild reproduces it, so nothing is
	 * gained by destroying the record of what was indexed, and re-indexing the same source revives it.
	 *
	 * @param entity The entity key.
	 * @param entityIds The ids to remove.
	 * @returns How many documents were removed.
	 */
	async delete(entity: string, entityIds: ID[]): Promise<number> {
		const ids = (entityIds ?? []).map((id) => String(id)).filter(Boolean);

		if (!entity || ids.length === 0) {
			return 0;
		}

		const result = await this.typeOrmSearchDocumentRepository.softDelete({
			entity: String(entity),
			entityId: In(ids)
		} as any);

		return Number(result?.affected ?? 0);
	}

	/* --------------------------------------------------------------------------------------------
	 * Reading
	 * ------------------------------------------------------------------------------------------ */

	/**
	 * Runs a query and returns a ranked, faceted page.
	 *
	 * @param request The request, in the terms every provider implements.
	 * @param allowedEntities The entity keys the caller may see, resolved per type by the caller.
	 * @returns The page, the total and the facets of the same predicate.
	 */
	async query(request: ISearchRequest, allowedEntities: string[]): Promise<ISearchResult> {
		const entities = this.scopeEntities(request, allowedEntities);

		if (entities.length === 0) {
			return { items: [], total: 0, facets: [], searchedEntities: [] };
		}

		const context = this.createContext(request, entities);

		try {
			return await this.runQuery(context);
		} catch (error) {
			if (!this.degrade(context, error)) {
				throw error;
			}

			return this.runQuery(context);
		}
	}

	/**
	 * Type-ahead over the same index.
	 *
	 * Suggestions come from the indexed titles, because a suggestion is the name of a thing and not a
	 * second full-text search: a prefix over the title first and a match over the promoted keywords
	 * second, which is the order a person expects a list of completions to be ordered in.
	 *
	 * @param request The request.
	 * @param allowedEntities The entity keys the caller may see.
	 * @param limit The largest number of suggestions to return.
	 * @returns The suggestions.
	 */
	async suggest(request: ISearchRequest, allowedEntities: string[], limit: number): Promise<ISearchSuggestion[]> {
		const entities = this.scopeEntities(request, allowedEntities);
		const term = String(request?.q ?? '').trim().toLowerCase();

		if (entities.length === 0 || !term) {
			return [];
		}

		const context = this.createContext(request, entities);
		const take = Math.max(1, Math.min(Number(limit) || SEARCH_SETTING_DEFAULTS.suggestLimit, 100));
		const params: Record<string, unknown> = {};
		const query = this.createBaseQuery(context, params);

		query.andWhere(
			`(LOWER(doc.title) LIKE :${this.addParam(params, 'suggestPrefix', `${term}%`)} ` +
				`OR LOWER(doc.title) LIKE :${this.addParam(params, 'suggestWithin', `%${term}%`)} ` +
				`OR LOWER(doc.keywords) LIKE :${this.addParam(params, 'suggestToken', `%${term}%`)})`,
			params
		);

		const rows = await query
			.select(['doc.entity', 'doc.entityId', 'doc.title'])
			.orderBy('doc.title', 'ASC')
			.take(take)
			.getMany();

		return rows.map((row: any) => ({
			text: String(row.title ?? ''),
			entity: String(row.entity ?? ''),
			entityId: row.entityId as ID
		}));
	}

	/**
	 * Reports whether the built-in index is reachable.
	 *
	 * The probe is a single-row read rather than a count: a health check on a table with millions of
	 * documents must not be the most expensive query the platform runs.
	 *
	 * @returns The report.
	 */
	async health(): Promise<ISearchProviderHealth> {
		try {
			await this.typeOrmSearchDocumentRepository.createQueryBuilder('doc').select('doc.id').limit(1).getRawOne();

			return {
				key: this.key,
				healthy: true,
				external: false,
				detail: 'The built-in search index is reachable.'
			};
		} catch (error) {
			return {
				key: this.key,
				healthy: false,
				external: false,
				detail: (error as Error)?.message ?? String(error)
			};
		}
	}

	/* --------------------------------------------------------------------------------------------
	 * Query construction
	 * ------------------------------------------------------------------------------------------ */

	/**
	 * Runs the page, its total and its facets against one predicate.
	 *
	 * @param context The resolved query context.
	 * @returns The result set.
	 */
	private async runQuery(context: ISearchQueryContext): Promise<ISearchResult> {
		const total = await this.buildQuery(context, false).getCount();

		let items: ISearchHit[] = [];

		if (total > 0) {
			const pageQuery = this.buildQuery(context, true);

			this.applyOrdering(pageQuery, context);
			pageQuery.skip(Math.max(0, Number(context.request?.skip) || 0));
			pageQuery.take(this.pageSize(context.request?.take));

			const { entities, raw } = await pageQuery.getRawAndEntities();

			items = (entities ?? []).map((row: any, index: number) => ({
				entity: String(row.entity ?? ''),
				entityId: row.entityId as ID,
				title: String(row.title ?? ''),
				score: Number((raw?.[index] as any)?.score ?? 0),
				highlight: this.buildHighlight(row, context.terms),
				attributes: row.attributes ?? undefined
			}));
		}

		const facets = await this.computeFacets(context);

		return { items, total, facets, searchedEntities: context.entities };
	}

	/**
	 * Resolves a request into everything the query builders share.
	 *
	 * @param request The request.
	 * @param entities The entity keys in scope.
	 * @returns The context.
	 */
	private createContext(request: ISearchRequest, entities: string[]): ISearchQueryContext {
		const dialect = this.dialect;

		return {
			request,
			entities,
			tenantId: RequestContext.currentTenantId(),
			organizationId: request?.organizationId ?? RequestContext.currentOrganizationId(),
			matchMode: request?.matchMode ?? SearchMatchMode.ANY,
			terms: this.tokenise(request?.q),
			useFullText: !this.degraded.has(`${dialect}:fulltext`),
			useJsonPath: !this.degraded.has(`${dialect}:json`)
		};
	}

	/**
	 * Narrows the caller's permitted entities to the requested ones.
	 *
	 * Both inputs bound the answer: an entity the caller may not read is dropped even when the request
	 * names it, and an entity the request does not name is dropped even when the caller may read it.
	 *
	 * @param request The request.
	 * @param allowedEntities The entity keys the caller may see.
	 * @returns The entity keys in scope.
	 */
	private scopeEntities(request: ISearchRequest, allowedEntities: string[]): string[] {
		const registered = new Set(this.indexRegistry.registeredEntities());

		const permitted = (allowedEntities ?? [])
			.map((entity) => String(entity))
			.filter((entity) => registered.has(entity));
		const requested = (request?.entities ?? []).map((entity) => String(entity));

		if (requested.length === 0) {
			return permitted;
		}

		const wanted = new Set(requested);

		return permitted.filter((entity) => wanted.has(entity));
	}

	/**
	 * The tenant, organization, entity and channel scope every query starts from.
	 *
	 * A document with no organization is a genuinely global row, so it is visible inside any
	 * organization scope rather than belonging to none — the same reading the schema gives the column.
	 *
	 * @param context The query context.
	 * @param params The parameter bag shared by the whole statement.
	 * @returns The builder.
	 */
	private createBaseQuery(
		context: ISearchQueryContext,
		params: Record<string, unknown>
	): SelectQueryBuilder<SearchDocument> {
		const query = this.typeOrmSearchDocumentRepository.createQueryBuilder('doc');

		query.where('doc.deletedAt IS NULL');
		query.andWhere('doc.entity IN (:...scopedEntities)', { scopedEntities: context.entities });

		if (context.tenantId) {
			query.andWhere('doc.tenantId = :scopedTenantId', { scopedTenantId: context.tenantId });
		}

		if (context.organizationId) {
			query.andWhere('(doc.organizationId = :scopedOrganizationId OR doc.organizationId IS NULL)', {
				scopedOrganizationId: context.organizationId
			});
		}

		if (context.request?.channelId) {
			// The channel is carried as a promoted token rather than a column, because the table's columns
			// are the schema's and the schema gives the document no channel of its own.
			const fragment = this.tokenFragment(
				params,
				'doc.keywords',
				`channelid:${String(context.request.channelId).toLowerCase()}`,
				'EQ'
			);

			query.andWhere(fragment, params);
		}

		return query;
	}

	/**
	 * Builds a query for the page, or for the count that belongs to it.
	 *
	 * @param context The query context.
	 * @param withScore Whether the relevance expression is selected. The count does not need it, and
	 * selecting it would put a ranking function inside a `COUNT`.
	 * @param sharedParams An existing parameter bag to write into, when the statement is extended after
	 * this call. Every fragment of one statement must share one bag, or two fragments can allocate the
	 * same parameter name and silently overwrite each other's value.
	 * @returns The builder.
	 */
	private buildQuery(
		context: ISearchQueryContext,
		withScore: boolean,
		sharedParams?: Record<string, unknown>
	): SelectQueryBuilder<SearchDocument> {
		const params = sharedParams ?? {};
		const query = this.createBaseQuery(context, params);
		const score = this.applyTextMatch(query, context, params);

		this.applyFilters(query, context, params);

		if (withScore) {
			query.addSelect(score ?? this.weightExpression(context), 'score');
		}

		return query;
	}

	/**
	 * Applies the free-text predicate and returns the ranking expression.
	 *
	 * @param query The builder.
	 * @param context The query context.
	 * @param params The parameter bag the fragment writes into.
	 * @returns The ranking expression, or `null` when the request carries no text to rank by.
	 */
	private applyTextMatch(
		query: SelectQueryBuilder<SearchDocument>,
		context: ISearchQueryContext,
		params: Record<string, unknown>
	): string | null {
		if (context.terms.length === 0) {
			return null;
		}

		if (context.useFullText && this.dialect === 'postgres') {
			// The query is built from sanitised terms and passed as a parameter, never concatenated into
			// the statement, so a term that looks like an operator cannot change the question.
			const expression =
				context.matchMode === SearchMatchMode.PHRASE
					? `phraseto_tsquery('simple', :${this.addParam(params, 'tsPhrase', context.terms.join(' '))})`
					: `to_tsquery('simple', :${this.addParam(
							params,
							'tsQuery',
							context.terms.join(context.matchMode === SearchMatchMode.ALL ? ' & ' : ' | ')
						)})`;

			query.andWhere(`doc."searchVector" @@ ${expression}`, params);

			return `ts_rank(doc."searchVector", ${expression}) * ${this.weightExpression(context)}`;
		}

		if (context.useFullText && this.dialect === 'mysql') {
			const matchAgainst =
				context.matchMode === SearchMatchMode.PHRASE
					? `"${context.terms.join(' ')}"`
					: context.matchMode === SearchMatchMode.ALL
						? context.terms.map((term) => `+${term}*`).join(' ')
						: context.terms.join(' ');

			const predicate = `MATCH(doc.title, doc.body) AGAINST (:${this.addParam(
				params,
				'matchBoolean',
				matchAgainst
			)} IN BOOLEAN MODE)`;
			const rank = `MATCH(doc.title, doc.body) AGAINST (:${this.addParam(
				params,
				'matchRank',
				context.terms.join(' ')
			)})`;

			query.andWhere(predicate, params);

			return `${rank} * ${this.weightExpression(context)}`;
		}

		// The portable path: a token match over the title, the body and the promoted keywords, combined
		// the way the request asked for. It is what SQLite is served by, and what any dialect falls back
		// to when its own text capability is unavailable.
		//
		// Every fragment that is built here is used, and no fragment is built twice: a parameter that
		// reaches the driver without appearing in the statement is a binding error on some dialects.
		const terms = context.matchMode === SearchMatchMode.PHRASE ? [context.terms.join(' ')] : context.terms;

		const fragments = terms.map((term) => {
			const name = this.addParam(params, 'likeTerm', `%${term}%`);

			return `(LOWER(doc.title) LIKE :${name} OR LOWER(doc.body) LIKE :${name} OR LOWER(doc.keywords) LIKE :${name})`;
		});

		const joined = fragments.join(context.matchMode === SearchMatchMode.ALL ? ' AND ' : ' OR ');

		query.andWhere(`(${joined})`, params);

		// No dialect text score is available on this path, so relevance is the document's own weight and
		// the title breaks the tie. That is a weaker ranking, and it is described as one rather than
		// presented as a relevance computation the backend did not perform.
		return this.weightExpression(context);
	}

	/**
	 * Applies every filter predicate.
	 *
	 * A filter names a declared field of the entity it applies to. A filter that names a field no
	 * definition in scope declares is refused, because a filter that silently matches nothing is
	 * indistinguishable from a filter that is spelled wrong.
	 *
	 * @param query The builder.
	 * @param context The query context.
	 * @param params The parameter bag shared by the whole statement.
	 */
	private applyFilters(
		query: SelectQueryBuilder<SearchDocument>,
		context: ISearchQueryContext,
		params: Record<string, unknown>
	): void {
		for (const filter of context.request?.filters ?? []) {
			if (!filter?.attribute) {
				continue;
			}

			const targets = context.entities
				.map((entity) => ({ entity, definition: this.indexRegistry.get(entity) }))
				.filter(
					(target) =>
						Boolean(filter.entity ? target.entity === filter.entity : true) &&
						Boolean(this.fieldOf(target.definition, filter.attribute))
				);

			if (targets.length === 0) {
				throw new BadRequestException(
					`No index definition declares the field "${filter.attribute}" for ` +
						`${filter.entity ? `the entity "${filter.entity}"` : 'any entity in scope'}.`
				);
			}

			const branches: string[] = [];

			for (const target of targets) {
				const field = this.fieldOf(target.definition, filter.attribute);

				if (!field?.filterable) {
					throw new BadRequestException(
						`The field "${filter.attribute}" of "${target.entity}" is not filterable, so it cannot be narrowed on.`
					);
				}

				const entityParam = this.addParam(params, 'filterEntity', target.entity);
				const predicate = this.filterFragment(params, target.definition, field, filter);

				branches.push(`(doc.entity = :${entityParam} AND ${predicate})`);
			}

			query.andWhere(`(${branches.join(' OR ')})`, params);
		}
	}

	/**
	 * Builds the predicate of one filter on one declared field.
	 *
	 * @param params The parameter bag.
	 * @param definition The declaration the field belongs to.
	 * @param field The declared field.
	 * @param filter The filter.
	 * @returns The SQL fragment.
	 */
	private filterFragment(
		params: Record<string, unknown>,
		definition: ISearchIndexRegistration,
		field: ISearchIndexField,
		filter: ISearchFilter
	): string {
		const promoted = this.isPromoted(definition, field);
		const values = Array.isArray(filter.value) ? filter.value : [filter.value];

		switch (filter.operator) {
			case SearchFilterOperator.EQ:
				return this.valueFragment(params, promoted, field, filter.value, 'EQ');

			case SearchFilterOperator.NEQ:
				return `NOT (${this.valueFragment(params, promoted, field, filter.value, 'EQ')})`;

			case SearchFilterOperator.IN:
				return `(${values
					.map((value) => this.valueFragment(params, promoted, field, value, 'EQ'))
					.join(' OR ')})`;

			case SearchFilterOperator.NIN:
				return `NOT (${values
					.map((value) => this.valueFragment(params, promoted, field, value, 'EQ'))
					.join(' OR ')})`;

			case SearchFilterOperator.CONTAINS:
				return this.valueFragment(params, promoted, field, filter.value, 'CONTAINS');

			case SearchFilterOperator.STARTS_WITH:
				return this.valueFragment(params, promoted, field, filter.value, 'STARTS_WITH');

			case SearchFilterOperator.EXISTS:
				return `${this.attributeExpression(field.name)} IS NOT NULL`;

			case SearchFilterOperator.BETWEEN: {
				const [from, to] = values;

				return (
					`${this.attributeExpression(field.name)} >= :${this.addParam(
						params,
						'betweenFrom',
						this.comparable(field, from)
					)} AND ` +
					`${this.attributeExpression(field.name)} <= :${this.addParam(
						params,
						'betweenTo',
						this.comparable(field, to)
					)}`
				);
			}

			case SearchFilterOperator.GT:
			case SearchFilterOperator.GTE:
			case SearchFilterOperator.LT:
			case SearchFilterOperator.LTE: {
				const operator =
					filter.operator === SearchFilterOperator.GT
						? '>'
						: filter.operator === SearchFilterOperator.GTE
							? '>='
							: filter.operator === SearchFilterOperator.LT
								? '<'
								: '<=';

				return `${this.attributeExpression(field.name)} ${operator} :${this.addParam(
					params,
					'compare',
					this.comparable(field, filter.value)
				)}`;
			}

			default:
				return this.valueFragment(params, promoted, field, filter.value, 'CONTAINS');
		}
	}

	/**
	 * One value predicate: over the promoted tokens where the field is promoted, and over the attribute
	 * map where it is not.
	 *
	 * @param params The parameter bag.
	 * @param promoted Whether the field is promoted into the document's keywords.
	 * @param field The declared field.
	 * @param value The value.
	 * @param mode How the value must match.
	 * @returns The SQL fragment.
	 */
	private valueFragment(
		params: Record<string, unknown>,
		promoted: boolean,
		field: ISearchIndexField,
		value: unknown,
		mode: 'EQ' | 'CONTAINS' | 'STARTS_WITH'
	): string {
		if (promoted && field.kind !== SearchFieldKind.NUMBER && field.kind !== SearchFieldKind.DATE) {
			// A promoted field is addressable through its tokens, which is the path that works on every
			// dialect: the token carries the field name, so one token list serves every facet and filter.
			const token = mode === 'CONTAINS' ? String(value).toLowerCase() : `${field.name}:${String(value).toLowerCase()}`;

			return this.tokenFragment(params, 'doc.keywords', token, mode);
		}

		if (field.kind === SearchFieldKind.TEXT) {
			const lowered = String(value).toLowerCase();
			const name = this.addParam(
				params,
				'text',
				mode === 'CONTAINS' ? `%${lowered}%` : mode === 'STARTS_WITH' ? `${lowered}%` : lowered
			);

			return mode === 'EQ'
				? `LOWER(doc.title) = :${name}`
				: `(LOWER(doc.title) LIKE :${name} OR LOWER(doc.body) LIKE :${name} OR LOWER(doc.keywords) LIKE :${name})`;
		}

		const name = this.addParam(params, 'attribute', this.comparable(field, value));

		return mode === 'EQ'
			? `${this.attributeExpression(field.name)} = :${name}`
			: `${this.attributeExpression(field.name)} LIKE :${this.addParam(
					params,
					'attributeLike',
					`%${String(value)}%`
				)}`;
	}

	/**
	 * A token predicate over a comma-joined token column.
	 *
	 * The patterns are built in JavaScript and passed as parameters, so the fragment is identical on
	 * every dialect and no dialect's string-concatenation operator appears in the statement.
	 *
	 * @param params The parameter bag.
	 * @param column The token column.
	 * @param token The token; a prefixed one for an exact match, a bare value for a contains match.
	 * @param mode How the token must match.
	 * @returns The SQL fragment.
	 */
	private tokenFragment(
		params: Record<string, unknown>,
		column: string,
		token: string,
		mode: 'EQ' | 'CONTAINS' | 'STARTS_WITH'
	): string {
		if (mode === 'CONTAINS' || mode === 'STARTS_WITH') {
			return `LOWER(${column}) LIKE :${this.addParam(params, 'tokenLike', `%${token}%`)}`;
		}

		const exact = this.addParam(params, 'tokenExact', token);
		const head = this.addParam(params, 'tokenHead', `${token},%`);
		const tail = this.addParam(params, 'tokenTail', `%,${token}`);
		const middle = this.addParam(params, 'tokenMiddle', `%,${token},%`);

		return `(LOWER(${column}) = :${exact} OR LOWER(${column}) LIKE :${head} OR LOWER(${column}) LIKE :${tail} OR LOWER(${column}) LIKE :${middle})`;
	}

	/**
	 * The ordering of a page.
	 *
	 * Relevance first and the title second, always: two documents with the same score must come back in
	 * the same order on every run, or a client that pages a result set sees the same hit twice and never
	 * sees another one.
	 *
	 * @param query The builder.
	 * @param context The query context.
	 */
	private applyOrdering(query: SelectQueryBuilder<SearchDocument>, context: ISearchQueryContext): void {
		const sort = context.request?.sort;
		const direction = sort?.direction === SearchSortDirection.ASC ? 'ASC' : 'DESC';

		if (sort?.attribute && sort.attribute !== 'score' && sort.attribute !== 'relevance') {
			const target = context.entities
				.map((entity) => ({ entity, definition: this.indexRegistry.get(entity) }))
				.filter((candidate) => Boolean(this.fieldOf(candidate.definition, sort.attribute)))
				.shift();

			if (!target) {
				throw new BadRequestException(
					`No index definition in scope declares the field "${sort.attribute}", so the result cannot be ordered by it.`
				);
			}

			const field = this.fieldOf(target.definition, sort.attribute);

			query.orderBy(this.attributeExpression(field.name), direction);
			query.addOrderBy('score', 'DESC');
			query.addOrderBy('doc.title', 'ASC');

			return;
		}

		query.orderBy('score', 'DESC');
		query.addOrderBy('doc.title', 'ASC');
	}

	/**
	 * Computes the facet counts of the page's predicate.
	 *
	 * A facet value's count is a real aggregation over the documents the same predicate selects: a field
	 * promoted into the keywords is counted by grouping the token column and splitting each bucket, and
	 * a field that is not promoted is counted by grouping the attribute the value lives in. A field the
	 * request names but no definition declares, or one whose declaration does not mark it facetable, is
	 * skipped — an empty facet list is a statement that nothing was counted, never a fabricated zero.
	 *
	 * The facet is counted once per declaration that declares it, and each of those counts is taken over
	 * that declaration's own entity type: a declaration that answers a facet is answering for the rows
	 * it describes, and a count taken over the whole scope would report every value once per declaration
	 * that declares the field rather than once per document. The declarations in scope remain the only
	 * thing that decides whether the facet exists at all, so a field one entity declares and another does
	 * not is still the first entity's facet.
	 *
	 * @param context The query context.
	 * @returns The facets, merged across entity types by attribute name.
	 */
	private async computeFacets(context: ISearchQueryContext): Promise<ISearchFacet[]> {
		const requested = context.request?.facets ?? [];

		if (requested.length === 0 || !SEARCH_SETTING_DEFAULTS.facetCountsEnabled) {
			return [];
		}

		const counts = new Map<string, Map<string, number>>();

		for (const entity of context.entities) {
			const definition = this.indexRegistry.get(entity);

			for (const name of requested) {
				const field = this.fieldOf(definition, name);

				if (!field?.facetable) {
					continue;
				}

				if (this.isPromoted(definition, field)) {
					await this.countKeywordFacet(context, entity, name, counts);
					continue;
				}

				if (!context.useJsonPath) {
					// The dialect cannot extract the attribute, so nothing is counted for this facet. An
					// absent facet is honest; a zero would claim a value occurs nowhere.
					continue;
				}

				await this.countAttributeFacet(context, entity, name, counts);
			}
		}

		return Array.from(counts.entries()).map(([attribute, values]) => ({
			attribute,
			values: Array.from(values.entries())
				.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
				.slice(0, FACET_VALUE_LIMIT)
				.map(([value, count]) => ({ value, count }))
		}));
	}

	/**
	 * Counts the values of a field promoted into the documents' keywords.
	 *
	 * @param context The query context.
	 * @param entity The entity type whose declaration is being counted.
	 * @param attribute The declared field name.
	 * @param counts The accumulator.
	 */
	private async countKeywordFacet(
		context: ISearchQueryContext,
		entity: string,
		attribute: string,
		counts: Map<string, Map<string, number>>
	): Promise<void> {
		const params: Record<string, unknown> = {};
		const query = this.buildQuery(context, false, params);

		query.andWhere(`doc.entity = :${this.addParam(params, 'facetEntity', entity)}`, params);
		query.andWhere(
			`LOWER(doc.keywords) LIKE :${this.addParam(params, 'facetToken', `%${attribute.toLowerCase()}:%`)}`,
			params
		);
		query.select('doc.keywords', 'bucket');
		query.addSelect('COUNT(*)', 'count');
		query.groupBy('doc.keywords');

		const rows = await query.getRawMany();

		for (const row of rows ?? []) {
			for (const token of String((row as any)?.bucket ?? '').split(',')) {
				const separator = token.indexOf(':');

				if (separator <= 0) {
					continue;
				}

				if (token.slice(0, separator).trim().toLowerCase() !== attribute.toLowerCase()) {
					continue;
				}

				this.increment(counts, attribute, token.slice(separator + 1).trim(), Number((row as any)?.count ?? 0));
			}
		}
	}

	/**
	 * Counts the values of a field that lives in the attribute map.
	 *
	 * @param context The query context.
	 * @param entity The entity type whose declaration is being counted.
	 * @param attribute The declared field name.
	 * @param counts The accumulator.
	 */
	private async countAttributeFacet(
		context: ISearchQueryContext,
		entity: string,
		attribute: string,
		counts: Map<string, Map<string, number>>
	): Promise<void> {
		const expression = this.attributeExpression(attribute);
		const params: Record<string, unknown> = {};
		const query = this.buildQuery(context, false, params);

		query.andWhere(`doc.entity = :${this.addParam(params, 'facetEntity', entity)}`, params);
		query.andWhere(`${expression} IS NOT NULL`);
		query.select(expression, 'bucket');
		query.addSelect('COUNT(*)', 'count');
		query.groupBy(expression);

		const rows = await query.getRawMany();

		for (const row of rows ?? []) {
			const bucket = (row as any)?.bucket;

			if (bucket === null || bucket === undefined || bucket === '') {
				continue;
			}

			this.increment(counts, attribute, String(bucket), Number((row as any)?.count ?? 0));
		}
	}

	/**
	 * Adds a count into the accumulator.
	 *
	 * @param counts The accumulator.
	 * @param attribute The facet attribute.
	 * @param value The facet value.
	 * @param count The count to add.
	 */
	private increment(counts: Map<string, Map<string, number>>, attribute: string, value: string, count: number): void {
		const values = counts.get(attribute) ?? new Map<string, number>();

		values.set(value, (values.get(value) ?? 0) + (count || 1));
		counts.set(attribute, values);
	}

	/* --------------------------------------------------------------------------------------------
	 * Dialect
	 * ------------------------------------------------------------------------------------------ */

	/**
	 * The dialect family of the live connection.
	 *
	 * Detected from the connection rather than from an environment variable, because a deployment may
	 * run more than one and a query must be written for the connection it is actually sent on.
	 */
	private get dialect(): SearchDialect {
		const type = String(this.typeOrmSearchDocumentRepository.manager?.connection?.options?.type ?? '');

		if (type === DatabaseTypeEnum.postgres) {
			return 'postgres';
		}

		if (type === DatabaseTypeEnum.mysql) {
			return 'mysql';
		}

		return 'sqlite';
	}

	/**
	 * The document's own weight, read from the attribute map the indexer wrote it into.
	 *
	 * The weight is normalised when a document is indexed rather than when it is queried, which is what
	 * makes two entity types comparable: adding a searchable entity cannot reorder the entities that
	 * were already there, because the numbers it contributes were fixed before it existed.
	 *
	 * @param context The query context.
	 * @returns The expression, or the constant `1` when the dialect cannot evaluate one.
	 */
	private weightExpression(context: ISearchQueryContext): string {
		return context.useJsonPath ? `COALESCE(${this.attributeExpression(WEIGHT_ATTRIBUTE)}, 1)` : '1';
	}

	/**
	 * The expression that reads one attribute out of the document's attribute map.
	 *
	 * The comparison is numeric on every dialect: a weight, a price or a quantity is compared as a
	 * number, and a decimal cast keeps the comparison exact rather than approximate.
	 *
	 * @param name The declared field name.
	 * @returns The SQL expression.
	 */
	private attributeExpression(name: string): string {
		const path = this.safePath(name);

		switch (this.dialect) {
			case 'postgres':
				return `CAST(doc.attributes ->> '${path}' AS DECIMAL(20,6))`;
			case 'mysql':
				return `CAST(JSON_UNQUOTE(JSON_EXTRACT(doc.attributes, '$.${path}')) AS DECIMAL(20,6))`;
			default:
				return `CAST(json_extract(doc.attributes, '$.${path}') AS NUMERIC)`;
		}
	}

	/**
	 * The value an attribute comparison is made against.
	 *
	 * A number and a boolean are compared as themselves; everything else is compared as text. A date is
	 * stored as the ISO-8601 string the source column carried, and ISO-8601 strings compare
	 * chronologically, so a range filter over dates is a range filter over their text.
	 *
	 * @param field The declared field.
	 * @param value The value.
	 * @returns The comparable value.
	 */
	private comparable(field: ISearchIndexField, value: unknown): string | number {
		if (field.kind === SearchFieldKind.NUMBER) {
			const numeric = Number(value);

			return Number.isFinite(numeric) ? numeric : String(value);
		}

		if (field.kind === SearchFieldKind.BOOLEAN) {
			return value === true || String(value).toLowerCase() === 'true' ? 1 : 0;
		}

		return value === null || value === undefined ? '' : String(value);
	}

	/**
	 * Whether a declared field is promoted into the documents' keyword tokens.
	 *
	 * @param definition The declaration.
	 * @param field The field.
	 * @returns True when the declaration promotes it.
	 */
	private isPromoted(definition: ISearchIndexRegistration, field: ISearchIndexField): boolean {
		return (definition?.keywordFields ?? []).includes(field.name);
	}

	/**
	 * Refuses a name that could not be a declared field name.
	 *
	 * Every name that reaches a dialect expression comes from a declaration, and a declaration is
	 * validated on registration — this is the second lock on the same door, so a future caller that
	 * passes a request value straight through cannot turn it into SQL.
	 *
	 * @param name The name.
	 * @returns The name, when it is safe.
	 */
	private safePath(name: string): string {
		const path = String(name ?? '');

		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(path)) {
			throw new BadRequestException(`"${path}" is not a usable attribute name.`);
		}

		return path;
	}

	/* --------------------------------------------------------------------------------------------
	 * Helpers
	 * ------------------------------------------------------------------------------------------ */

	/**
	 * The declaration of one field, when the definition declares it.
	 *
	 * @param definition The declaration.
	 * @param name The field name.
	 * @returns The field, or `undefined`.
	 */
	private fieldOf(definition: ISearchIndexRegistration, name: string): ISearchIndexField | undefined {
		return (definition?.fields ?? []).find((field) => field.name === name);
	}

	/**
	 * The requested page size, bounded by the configured limit.
	 *
	 * @param take What the request asked for.
	 * @returns The page size.
	 */
	private pageSize(take?: number): number {
		const requested = Number(take);

		if (!Number.isFinite(requested) || requested <= 0) {
			return SEARCH_SETTING_DEFAULTS.resultPageSizeLimit;
		}

		return Math.min(Math.floor(requested), SEARCH_SETTING_DEFAULTS.resultPageSizeLimit);
	}

	/**
	 * Splits a query into the terms a match is built from.
	 *
	 * The characters that carry meaning in a text-search expression are removed, because a term that
	 * reaches an expression as an operator is a term that changes the question.
	 *
	 * @param q The query.
	 * @returns The terms, lower-cased.
	 */
	private tokenise(q?: string): string[] {
		return String(q ?? '')
			.toLowerCase()
			.split(/\s+/)
			.map((term) => term.replace(/[&|!()<>:*'\\"]/g, '').trim())
			.filter(Boolean);
	}

	/**
	 * A short fragment of the document around the first term it matched.
	 *
	 * A highlight is a presentation aid, so it is produced from the indexed title and body and never by
	 * asking the backend to mark up a stored document it does not have.
	 *
	 * @param row The document row.
	 * @param terms The terms the query was matched with.
	 * @returns The fragment, or `undefined` when nothing matched in the text.
	 */
	private buildHighlight(row: any, terms: string[]): string | undefined {
		if (terms.length === 0) {
			return undefined;
		}

		const title = String(row?.title ?? '');
		const body = String(row?.body ?? '');

		for (const term of terms) {
			for (const source of [title, body]) {
				const at = source.toLowerCase().indexOf(term);

				if (at >= 0) {
					const from = Math.max(0, at - 40);
					const to = Math.min(source.length, at + term.length + 60);
					const fragment = source.slice(from, to).trim();

					return `${from > 0 ? '…' : ''}${fragment}${to < source.length ? '…' : ''}`;
				}
			}
		}

		return undefined;
	}

	/**
	 * Registers a parameter under a name that is not already taken.
	 *
	 * @param params The parameter bag.
	 * @param prefix The name prefix.
	 * @param value The value.
	 * @returns The parameter name, without its colon.
	 */
	private addParam(params: Record<string, unknown>, prefix: string, value: unknown): string {
		let index = 1;
		let name = `${prefix}${index}`;

		while (Object.prototype.hasOwnProperty.call(params, name)) {
			index += 1;
			name = `${prefix}${index}`;
		}

		params[name] = value;

		return name;
	}

	/**
	 * Groups documents by the key the index is unique on.
	 *
	 * @param documents The documents.
	 * @returns The groups.
	 */
	private groupByDocumentKey(
		documents: ISearchDocument[]
	): Array<{ tenantId: ID | null; entity: string; engineKey?: string; documents: ISearchDocument[] }> {
		const groups = new Map<
			string,
			{ tenantId: ID | null; entity: string; engineKey?: string; documents: ISearchDocument[] }
		>();

		for (const document of documents) {
			const tenantId = (document.tenantId ?? null) as ID | null;
			const entity = String(document.entity ?? '');
			const engineKey = document.engineKey ? String(document.engineKey) : undefined;
			const key = `${tenantId ?? ''}|${entity}|${engineKey ?? ''}`;

			if (!groups.has(key)) {
				groups.set(key, { tenantId, entity, engineKey, documents: [] });
			}

			groups.get(key)?.documents.push(document);
		}

		return Array.from(groups.values());
	}

	/**
	 * Records that a capability of the live dialect is unusable, so the next query does not pay for the
	 * failed attempt again.
	 *
	 * The two capabilities are separable on purpose: a deployment whose table predates the full-text
	 * index still gets weighted ranking over the attribute map, and a deployment whose SQLite build
	 * cannot evaluate a JSON path still gets a page ordered by the document weight and the title.
	 *
	 * @param context The query context.
	 * @param error The failure.
	 * @returns True when the failure was a capability that can be degraded and the caller should retry.
	 */
	private degrade(context: ISearchQueryContext, error: unknown): boolean {
		const message = String((error as Error)?.message ?? error).toLowerCase();
		const dialect = this.dialect;

		if (context.useFullText && dialect !== 'sqlite' && /fulltext|match |against|tsquery|tsvector|searchvector/.test(message)) {
			this.degraded.add(`${dialect}:fulltext`);
			context.useFullText = false;

			this.logger.warn(
				`The ${dialect} full-text capability is unavailable, so the portable token match answers instead: ${message}`
			);

			return true;
		}

		if (context.useJsonPath && /json|jsonb|json_extract|operator does not exist/.test(message)) {
			this.degraded.add(`${dialect}:json`);
			context.useJsonPath = false;

			this.logger.warn(
				`The ${dialect} JSON path capability is unavailable, so documents rank by their own weight: ${message}`
			);

			return true;
		}

		return false;
	}
}
