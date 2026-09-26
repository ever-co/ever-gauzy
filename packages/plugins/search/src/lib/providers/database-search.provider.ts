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
 * The character a `LIKE` pattern escapes its own wildcards with.
 *
 * `%` and `_` are wildcards inside the *value* of a `LIKE`, not inside the statement, so a
 * parameterised pattern is safe from injection and still completely open to a caller who types one:
 * `q=%` used to build `LIKE '%%%'`, which matches every document in scope and turns the term filter
 * into a full enumeration of the index. The wildcards are therefore escaped in the value and every
 * fragment that carries a caller-supplied pattern states its escape character.
 *
 * `!` is used rather than a backslash because the three dialects do not agree about backslashes in a
 * string literal: MySQL reads `'\'` as the start of an escape sequence and the statement no longer
 * parses, while Postgres and SQLite read it as one character. `!` has no meaning in any of them, so
 * one clause is correct everywhere — at the cost of escaping `!` itself, which {@link escapeLike}
 * does.
 */
const LIKE_ESCAPE = '!';

/** The clause every fragment whose pattern came from a caller carries. */
const LIKE_ESCAPE_CLAUSE = ` ESCAPE '${LIKE_ESCAPE}'`;

/**
 * How long a capability a failed statement proved unusable stays switched off.
 *
 * A capability flag with no expiry is a one-way door: one failure disables a feature of the whole
 * process for every tenant until the pod restarts, and nothing in the platform ever turns it back
 * on. A genuine capability gap — a table that predates the full-text index, a SQLite build compiled
 * without JSON1 — reasserts itself on the next probe and costs one failed statement every five
 * minutes, which is a price worth paying to make a transient or request-induced failure self-heal.
 */
const DEGRADED_CAPABILITY_TTL_MS = 5 * 60 * 1000;

/**
 * Which copies of a document a removal is about.
 *
 * A document is keyed by `(tenant, entity, entityId, engine)`, so a removal that names only the
 * entity and the id is a removal of every tenant's and every engine's copy of it. The scope is what
 * lets a caller that knows the other two members say so.
 *
 * `ISearchProvider.delete` in `@gauzy/contracts` still declares two parameters; the third is
 * additive and optional, so a provider that ignores it — an external engine that has not been
 * widened yet — keeps satisfying the contract and keeps behaving exactly as it did.
 */
export interface ISearchDeleteScope {
	/** The tenant whose documents are removed; `null` for the genuinely tenant-less rows. */
	tenantId?: ID | null;
	/** The engine whose documents are removed; `null` or absent for the built-in provider's own. */
	engineKey?: string | null;
}

/**
 * A provider that can narrow a removal the way {@link ISearchDeleteScope} describes.
 *
 * It exists because the scope is an additive third parameter on a contract that declares two: a
 * caller holding an `ISearchProvider` cannot pass it without saying, once and in one place, that it
 * is calling the widened form. A provider that does not implement it ignores the extra argument,
 * which is exactly the previous behaviour.
 */
export interface IScopedSearchDelete {
	delete(entity: string, entityIds: ID[], scope?: ISearchDeleteScope): Promise<number>;
}

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

	/**
	 * Capabilities of the live dialect that a failed query proved unusable, and the moment each one
	 * is probed again.
	 *
	 * It is a map of expiries rather than a set of names because a capability that is switched off
	 * forever is switched off for every tenant of the process, and the thing that switched it off was
	 * a single statement — possibly one a caller shaped. See {@link DEGRADED_CAPABILITY_TTL_MS}.
	 */
	private readonly degraded = new Map<string, number>();

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
	 * The removal is keyed on the same four members the write is — `(tenant, entity, entityId,
	 * engine)` — and not on two of them. A removal keyed on `(entity, entityId)` alone removes the
	 * document of every tenant that ever indexed a row with that id, and it removes an external
	 * engine's row for the same source as well, which then leaves that engine's own delete with
	 * nothing to do and its index out of step with the one it is supposed to own. The scope is
	 * optional so that a caller that genuinely means "every copy of this document" — a sweep that has
	 * already established there is only one — keeps working unchanged.
	 *
	 * @param entity The entity key.
	 * @param entityIds The ids to remove.
	 * @param scope The tenant and engine the removal belongs to; every tenant and every engine when
	 * the caller states none.
	 * @returns How many documents were removed.
	 */
	async delete(entity: string, entityIds: ID[], scope?: ISearchDeleteScope): Promise<number> {
		const ids = (entityIds ?? []).map((id) => String(id)).filter(Boolean);

		if (!entity || ids.length === 0) {
			return 0;
		}

		const criteria: Record<string, unknown> = {
			entity: String(entity),
			entityId: In(ids)
		};

		if (scope && 'tenantId' in scope) {
			criteria.tenantId = scope.tenantId ? scope.tenantId : IsNull();
		}

		if (scope && 'engineKey' in scope) {
			criteria.engineKey = scope.engineKey ? scope.engineKey : IsNull();
		}

		const result = await this.typeOrmSearchDocumentRepository.softDelete(criteria as any);

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

		// Type-ahead degrades and retries exactly as a query does. It used to be the one read path
		// with no recovery at all, which meant a capability the connection had just proved unusable
		// surfaced here as a 500 on every keystroke while the search box beside it recovered.
		try {
			return await this.runSuggest(context, term, take);
		} catch (error) {
			if (!this.degrade(context, error)) {
				throw error;
			}

			return await this.runSuggest(context, term, take);
		}
	}

	/**
	 * One attempt at the type-ahead read.
	 *
	 * @param context The resolved query context.
	 * @param term The lower-cased term being completed.
	 * @param take The largest number of suggestions to return.
	 * @returns The suggestions.
	 */
	private async runSuggest(
		context: ISearchQueryContext,
		term: string,
		take: number
	): Promise<ISearchSuggestion[]> {
		const params: Record<string, unknown> = {};
		const query = this.createBaseQuery(context, params);
		const escaped = this.escapeLike(term);
		const keywords = this.keywordsExpression();

		query.andWhere(
			`(LOWER(doc.title) LIKE :${this.addParam(params, 'suggestPrefix', `${escaped}%`)}${LIKE_ESCAPE_CLAUSE} ` +
				`OR LOWER(doc.title) LIKE :${this.addParam(
					params,
					'suggestWithin',
					`%${escaped}%`
				)}${LIKE_ESCAPE_CLAUSE} ` +
				`OR LOWER(${keywords}) LIKE :${this.addParam(
					params,
					'suggestToken',
					`%${escaped}%`
				)}${LIKE_ESCAPE_CLAUSE})`,
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
	 * The organization on the request is the caller's **already validated** scope, not a value the
	 * client chose: `SearchService.scopedOrganizationId` refuses a stated organization that the
	 * credential does not authorise before the request ever reaches a provider. The provider reads it
	 * rather than the credential because the service is the one place that knows which organizations
	 * a caller may narrow to, and because a provider is also driven by callers that are not requests
	 * at all.
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
			useFullText: !this.isDegraded(`${dialect}:fulltext`),
			useJsonPath: !this.isDegraded(`${dialect}:json`)
		};
	}

	/**
	 * Whether a capability is currently switched off.
	 *
	 * An entry whose expiry has passed is removed as it is read, so the next query probes the
	 * capability again rather than inheriting a verdict that a single statement reached minutes ago.
	 *
	 * @param capability The capability key, `<dialect>:<capability>`.
	 * @returns True while the capability is switched off.
	 */
	private isDegraded(capability: string): boolean {
		const until = this.degraded.get(capability);

		if (until === undefined) {
			return false;
		}

		if (until > Date.now()) {
			return true;
		}

		this.degraded.delete(capability);

		return false;
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
	 * **A scope that does not resolve narrows the read; it never widens it.** The tenant predicate
	 * used to be applied only when a tenant was resolved, so a call that reached the provider outside
	 * an authenticated request — a scheduled sweep, an outbox consumer, any future internal caller —
	 * emitted a statement with no tenant restriction at all and matched every tenant's documents.
	 * When no tenant resolves the predicate is now `doc.tenantId IS NULL`, which selects the
	 * genuinely tenant-less rows the indexer writes and nothing else.
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
		} else {
			query.andWhere('doc.tenantId IS NULL');
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
				this.keywordsExpression(),
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

		// A dialect's own text-search capability answers only when every term is one its parser can
		// read. One term of pure punctuation used to reach `to_tsquery` and raise `syntax error in
		// tsquery` — a 500 produced by a search box — and the alternative of silently dropping the term
		// would answer a different question from the one the caller asked. The portable path below can
		// match any character, so the whole query falls back to it instead.
		const parsable = context.terms.every((term) => this.isParsable(term));

		if (parsable && context.useFullText && this.dialect === 'postgres') {
			// The query is built from sanitised terms and passed as a parameter, never concatenated into
			// the statement, so a term that looks like an operator cannot change the question.
			//
			// Each lexeme is quoted inside the tsquery as well. `to_tsquery` parses its argument, so a
			// term that still carries a character the parser reads as a separator — `a%b`, `page/2` —
			// raises `syntax error in tsquery` and turns a search box into a 500. A quoted lexeme is
			// taken verbatim, and `'` is already removed by {@link tokenise}, so nothing inside the
			// quotes can close them.
			const lexemes = context.terms.map((term) => `'${term}'`);
			const expression =
				context.matchMode === SearchMatchMode.PHRASE
					? `phraseto_tsquery('simple', :${this.addParam(params, 'tsPhrase', context.terms.join(' '))})`
					: `to_tsquery('simple', :${this.addParam(
							params,
							'tsQuery',
							lexemes.join(context.matchMode === SearchMatchMode.ALL ? ' & ' : ' | ')
						)})`;

			query.andWhere(`doc."searchVector" @@ ${expression}`, params);

			return `ts_rank(doc."searchVector", ${expression}) * ${this.weightExpression(context)}`;
		}

		if (parsable && context.useFullText && this.dialect === 'mysql') {
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
		const keywords = this.keywordsExpression();

		const fragments = terms.map((term) => {
			const name = this.addParam(params, 'likeTerm', `%${this.escapeLike(term)}%`);

			return (
				`(LOWER(doc.title) LIKE :${name}${LIKE_ESCAPE_CLAUSE}` +
				` OR LOWER(doc.body) LIKE :${name}${LIKE_ESCAPE_CLAUSE}` +
				` OR LOWER(${keywords}) LIKE :${name}${LIKE_ESCAPE_CLAUSE})`
			);
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
				const predicate = this.filterFragment(params, context, target.definition, field, filter);

				branches.push(`(doc.entity = :${entityParam} AND ${predicate})`);
			}

			query.andWhere(`(${branches.join(' OR ')})`, params);
		}
	}

	/**
	 * Builds the predicate of one filter on one declared field.
	 *
	 * Every expression is built for the **declared kind** of the field rather than for one assumed
	 * kind. The attribute map holds text, dates, numbers, booleans and lists side by side, so an
	 * expression that casts whatever it finds to a decimal is correct for exactly one of them: on
	 * Postgres it aborts the statement with `invalid input syntax for type numeric`, on MySQL it
	 * truncates to zero with a warning, and on SQLite it silently evaluates to zero — which is why a
	 * SQLite-only verification saw nothing wrong. {@link attributeExpression} therefore takes the
	 * kind, and every call site here passes the field it already holds.
	 *
	 * When the connection's JSON path capability is unavailable the attribute map cannot be read at
	 * all, so a filter is answered from the promoted token list instead. That is weaker, and it is
	 * described as weaker: a field the declaration does not promote carries no token, so its branch
	 * matches nothing rather than matching rows the filter did not select.
	 *
	 * @param params The parameter bag.
	 * @param context The query context, which says which capabilities this statement may use.
	 * @param definition The declaration the field belongs to.
	 * @param field The declared field.
	 * @param filter The filter.
	 * @returns The SQL fragment.
	 */
	private filterFragment(
		params: Record<string, unknown>,
		context: ISearchQueryContext,
		definition: ISearchIndexRegistration,
		field: ISearchIndexField,
		filter: ISearchFilter
	): string {
		const promoted = this.isPromoted(definition, field);
		const values = Array.isArray(filter.value) ? filter.value : [filter.value];

		switch (filter.operator) {
			case SearchFilterOperator.EQ:
				return this.valueFragment(params, context, promoted, field, filter.value, 'EQ');

			case SearchFilterOperator.NEQ:
				return `NOT (${this.valueFragment(params, context, promoted, field, filter.value, 'EQ')})`;

			case SearchFilterOperator.IN:
				return `(${values
					.map((value) => this.valueFragment(params, context, promoted, field, value, 'EQ'))
					.join(' OR ')})`;

			case SearchFilterOperator.NIN:
				return `NOT (${values
					.map((value) => this.valueFragment(params, context, promoted, field, value, 'EQ'))
					.join(' OR ')})`;

			case SearchFilterOperator.CONTAINS:
				return this.valueFragment(params, context, promoted, field, filter.value, 'CONTAINS');

			case SearchFilterOperator.STARTS_WITH:
				return this.valueFragment(params, context, promoted, field, filter.value, 'STARTS_WITH');

			case SearchFilterOperator.EXISTS:
				if (!context.useJsonPath) {
					// Without the attribute map, "the document carries this field" is answered by the
					// presence of the field's own promoted token.
					return `LOWER(${this.keywordsExpression()}) LIKE :${this.addParam(
						params,
						'existsToken',
						`%"${this.escapeLike(this.safePath(field.name).toLowerCase())}:%`
					)}${LIKE_ESCAPE_CLAUSE}`;
				}

				return `${this.attributeExpression(field.name, field.kind)} IS NOT NULL`;

			case SearchFilterOperator.BETWEEN: {
				const [from, to] = values;

				if (!context.useJsonPath) {
					return this.unrankableFragment(field, filter.operator);
				}

				return (
					`${this.attributeExpression(field.name, field.kind)} >= :${this.addParam(
						params,
						'betweenFrom',
						this.comparable(field, from)
					)} AND ` +
					`${this.attributeExpression(field.name, field.kind)} <= :${this.addParam(
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

				if (!context.useJsonPath) {
					return this.unrankableFragment(field, filter.operator);
				}

				return `${this.attributeExpression(field.name, field.kind)} ${operator} :${this.addParam(
					params,
					'compare',
					this.comparable(field, filter.value)
				)}`;
			}

			default:
				return this.valueFragment(params, context, promoted, field, filter.value, 'CONTAINS');
		}
	}

	/**
	 * The predicate of a range comparison the connection cannot evaluate.
	 *
	 * A range over an attribute needs the attribute's value, and a connection whose JSON path
	 * capability is unavailable cannot produce one. There is no weaker form of "greater than" over a
	 * token list, so the branch selects nothing and says so in the log rather than dropping the
	 * predicate, which would return rows the caller asked to exclude.
	 *
	 * @param field The declared field.
	 * @param operator The operator that cannot be evaluated.
	 * @returns A fragment that matches nothing.
	 */
	private unrankableFragment(field: ISearchIndexField, operator: SearchFilterOperator): string {
		this.logger.warn(
			`The ${this.dialect} JSON path capability is unavailable, so the "${operator}" filter on ` +
				`"${field.name}" cannot be evaluated and its branch selects nothing.`
		);

		return '1 = 0';
	}

	/**
	 * One value predicate: over the promoted tokens where the field is promoted, and over the attribute
	 * map where it is not.
	 *
	 * @param params The parameter bag.
	 * @param context The query context, which says whether the attribute map can be read at all.
	 * @param promoted Whether the field is promoted into the document's keywords.
	 * @param field The declared field.
	 * @param value The value.
	 * @param mode How the value must match.
	 * @returns The SQL fragment.
	 */
	private valueFragment(
		params: Record<string, unknown>,
		context: ISearchQueryContext,
		promoted: boolean,
		field: ISearchIndexField,
		value: unknown,
		mode: 'EQ' | 'CONTAINS' | 'STARTS_WITH'
	): string {
		const keywords = this.keywordsExpression();

		if (promoted && field.kind !== SearchFieldKind.NUMBER && field.kind !== SearchFieldKind.DATE) {
			// A promoted field is addressable through its tokens, which is the path that works on every
			// dialect: the token carries the field name, so one token list serves every facet and filter.
			const token =
				mode === 'CONTAINS'
					? String(value).toLowerCase()
					: `${field.name.toLowerCase()}:${String(value).toLowerCase()}`;

			return this.tokenFragment(params, keywords, token, mode);
		}

		if (field.kind === SearchFieldKind.TEXT) {
			const lowered = this.escapeLike(String(value).toLowerCase());
			const name = this.addParam(
				params,
				'text',
				mode === 'CONTAINS'
					? `%${lowered}%`
					: mode === 'STARTS_WITH'
						? `${lowered}%`
						: String(value).toLowerCase()
			);

			return mode === 'EQ'
				? `LOWER(doc.title) = :${name}`
				: `(LOWER(doc.title) LIKE :${name}${LIKE_ESCAPE_CLAUSE}` +
						` OR LOWER(doc.body) LIKE :${name}${LIKE_ESCAPE_CLAUSE}` +
						` OR LOWER(${keywords}) LIKE :${name}${LIKE_ESCAPE_CLAUSE})`;
		}

		if (!context.useJsonPath) {
			// The attribute map cannot be read on this connection, so the field is answered from its
			// promoted token. A field the declaration does not promote carries none, and the branch then
			// matches nothing — which is the honest answer rather than an unfiltered one.
			const token =
				mode === 'CONTAINS'
					? String(value).toLowerCase()
					: `${field.name.toLowerCase()}:${String(value).toLowerCase()}`;

			return this.tokenFragment(params, keywords, token, mode);
		}

		if (mode === 'EQ') {
			const name = this.addParam(params, 'attribute', this.comparable(field, value));
			const expression = this.attributeExpression(field.name, field.kind);

			if (field.kind === SearchFieldKind.KEYWORD || field.kind === SearchFieldKind.ENTITY) {
				// A keyword attribute holds either one value or the JSON array the builder writes for a
				// multi-valued field — `["urgent","legal"]` — so equality against the scalar alone matches
				// none of the list's members. The second half of the predicate matches one member of the
				// encoded list, which is the same element-boundary match the token predicate uses.
				const member = this.addParam(
					params,
					'attributeMember',
					`%"${this.escapeLike(String(value).toLowerCase())}"%`
				);

				return `(${expression} = :${name} OR LOWER(${expression}) LIKE :${member}${LIKE_ESCAPE_CLAUSE})`;
			}

			return `${expression} = :${name}`;
		}

		// A substring match is a text operation whatever the declared kind is, so it is built over the
		// text extraction rather than over the kind's own expression: `LOWER()` of a decimal cast is not
		// a function Postgres has, and a prefix of a number is not a number.
		const text = this.attributeTextExpression(this.safePath(field.name));
		const lowered = this.escapeLike(String(value).toLowerCase());
		const pattern = this.addParam(
			params,
			'attributeLike',
			mode === 'STARTS_WITH' ? `${lowered}%` : `%${lowered}%`
		);

		return `LOWER(${text}) LIKE :${pattern}${LIKE_ESCAPE_CLAUSE}`;
	}

	/**
	 * A token predicate over the promoted token list.
	 *
	 * **The list is a JSON array, not a comma-joined string.** `SearchDocument.keywords` is declared
	 * `@JsonArrayColumn<string>`, which is `jsonb` on Postgres, `json` on MySQL and a `simple-json`
	 * text column on SQLite, and the builder writes `["colour:red","channelid:abc"]` into it on every
	 * one of them. The exact-match predicate used to be written for a scalar `a,b,c` column — `= 'x'`,
	 * `LIKE 'x,%'`, `LIKE '%,x'`, `LIKE '%,x,%'` — and none of those four patterns can match a JSON
	 * array, whose separator is `","` and which starts with `["`. That is why a channel-scoped search
	 * returned nothing on every dialect and every promoted `EQ` filter matched no row at all.
	 *
	 * The match is therefore made against the JSON encoding of one element: `%"token"%`. The quotes
	 * are the element boundary, so `status:pai` cannot match `status:paid`, and the pattern is
	 * insensitive to the whitespace the three dialects render an array with — Postgres and MySQL emit
	 * `", "` between elements and SQLite emits `","`.
	 *
	 * The patterns are built in JavaScript and passed as parameters, so the fragment is identical on
	 * every dialect and no dialect's string-concatenation operator appears in the statement.
	 *
	 * @param params The parameter bag.
	 * @param column The expression that renders the token list as text; see {@link keywordsExpression}.
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
		const escaped = this.escapeLike(String(token ?? '').toLowerCase());

		if (mode === 'CONTAINS') {
			return `LOWER(${column}) LIKE :${this.addParam(
				params,
				'tokenLike',
				`%${escaped}%`
			)}${LIKE_ESCAPE_CLAUSE}`;
		}

		if (mode === 'STARTS_WITH') {
			// Anchored on the opening quote of an element, so the token really is a prefix of one entry
			// rather than a substring of the encoded list.
			return `LOWER(${column}) LIKE :${this.addParam(
				params,
				'tokenHead',
				`%"${escaped}%`
			)}${LIKE_ESCAPE_CLAUSE}`;
		}

		return `LOWER(${column}) LIKE :${this.addParam(
			params,
			'tokenExact',
			`%"${escaped}"%`
		)}${LIKE_ESCAPE_CLAUSE}`;
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

			if (!context.useJsonPath) {
				// The attribute cannot be extracted on this connection, so the page falls back to the
				// documented weaker ordering rather than emitting a statement that cannot run. Naming the
				// field in the warning is what makes the weaker answer traceable.
				this.logger.warn(
					`The ${this.dialect} JSON path capability is unavailable, so the page could not be ordered ` +
						`by "${field.name}" and is ordered by relevance and title instead.`
				);

				query.orderBy('score', 'DESC');
				query.addOrderBy('doc.title', 'ASC');

				return;
			}

			query.orderBy(this.attributeExpression(field.name, field.kind), direction);
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

				await this.countAttributeFacet(context, entity, field, counts);
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
	 * The bucket a group carries is the whole token list, and the list is a JSON array — so it is
	 * parsed as one rather than split on commas. Splitting `["colour:red","size:m"]` on `,` yields
	 * `["colour` and `"size:m"]`, whose field names are `["colour` and `"size`, which match nothing
	 * and made every promoted facet come back empty. The driver hands the column back already parsed
	 * on the two dialects with a real JSON type and as text on SQLite, so both shapes are accepted.
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
		const keywords = this.keywordsExpression();

		query.andWhere(`doc.entity = :${this.addParam(params, 'facetEntity', entity)}`, params);
		query.andWhere(
			`LOWER(${keywords}) LIKE :${this.addParam(
				params,
				'facetToken',
				`%"${this.escapeLike(attribute.toLowerCase())}:%`
			)}${LIKE_ESCAPE_CLAUSE}`,
			params
		);
		query.select('doc.keywords', 'bucket');
		query.addSelect('COUNT(*)', 'count');
		query.groupBy('doc.keywords');

		const rows = await query.getRawMany();

		for (const row of rows ?? []) {
			for (const token of this.keywordTokens((row as any)?.bucket)) {
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
	 * The bucket is grouped on the field's own expression, which is the text extraction for every
	 * kind but a number — grouping a date or a tag list by a decimal cast buckets everything under
	 * zero on SQLite and aborts the statement on Postgres. A bucket that is itself a list is counted
	 * once per member, because a multi-valued field's facet is a count of its values and not a count
	 * of the combinations they occur in.
	 *
	 * @param context The query context.
	 * @param entity The entity type whose declaration is being counted.
	 * @param field The declared field.
	 * @param counts The accumulator.
	 */
	private async countAttributeFacet(
		context: ISearchQueryContext,
		entity: string,
		field: ISearchIndexField,
		counts: Map<string, Map<string, number>>
	): Promise<void> {
		const attribute = field.name;
		const expression = this.attributeExpression(attribute, field.kind);
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

			for (const value of this.facetValues(bucket)) {
				this.increment(counts, attribute, value, Number((row as any)?.count ?? 0));
			}
		}
	}

	/**
	 * The tokens one grouped keyword bucket holds.
	 *
	 * @param bucket Whatever the driver returned for the token column: a parsed array on Postgres and
	 * MySQL, the stored JSON text on SQLite, and — for a row written before the column became JSON —
	 * possibly still a comma-joined string, which is accepted rather than discarded.
	 * @returns The tokens.
	 */
	private keywordTokens(bucket: unknown): string[] {
		if (Array.isArray(bucket)) {
			return bucket.map((token) => String(token));
		}

		const text = String(bucket ?? '').trim();

		if (!text) {
			return [];
		}

		if (text.startsWith('[')) {
			try {
				const parsed = JSON.parse(text);

				if (Array.isArray(parsed)) {
					return parsed.map((token) => String(token));
				}
			} catch (error) {
				// Not valid JSON after all: fall through to the comma reading below rather than losing the
				// whole bucket over one malformed row.
			}
		}

		return text
			.split(',')
			.map((token) => token.trim())
			.filter(Boolean);
	}

	/**
	 * The facet values one grouped attribute bucket contributes.
	 *
	 * @param bucket Whatever the driver returned for the grouped expression.
	 * @returns One value per member of a list, or the single value the bucket is.
	 */
	private facetValues(bucket: unknown): string[] {
		if (Array.isArray(bucket)) {
			return bucket.map((value) => String(value)).filter((value) => value !== '');
		}

		const text = String(bucket).trim();

		if (text.startsWith('[')) {
			try {
				const parsed = JSON.parse(text);

				if (Array.isArray(parsed)) {
					return parsed.map((value) => String(value)).filter((value) => value !== '');
				}
			} catch (error) {
				// A value that merely begins with a bracket is still a value.
			}
		}

		return text ? [text] : [];
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
		return context.useJsonPath
			? `COALESCE(${this.attributeExpression(WEIGHT_ATTRIBUTE, SearchFieldKind.NUMBER)}, 1)`
			: '1';
	}

	/**
	 * The expression that renders the promoted token list as text.
	 *
	 * `keywords` is a JSON column on two of the four dialects — `jsonb` on Postgres, `json` on MySQL
	 * — and a `simple-json` text column on SQLite and better-sqlite3. `LOWER()` and `LIKE` are text
	 * operations, and Postgres has no `lower(jsonb)`: every keyword predicate used to abort the whole
	 * statement there with `function lower(jsonb) does not exist`, which took out type-ahead, every
	 * channel-scoped search and every promoted filter, while SQLite — where the column really is text
	 * — saw nothing wrong. The column is therefore rendered as text first, and the token predicate is
	 * written against that rendering.
	 *
	 * @returns The SQL expression.
	 */
	private keywordsExpression(): string {
		switch (this.dialect) {
			case 'postgres':
				return `CAST(doc.keywords AS TEXT)`;
			case 'mysql':
				return `CAST(doc.keywords AS CHAR)`;
			default:
				return `doc.keywords`;
		}
	}

	/**
	 * The expression that reads one attribute out of the document's attribute map, as text.
	 *
	 * This is the form every kind but a number is compared, grouped and ordered by. A date is stored
	 * as the ISO-8601 string its column carried and ISO-8601 strings compare chronologically, a
	 * keyword is a token, and a tag list is the JSON array the builder wrote — none of which is a
	 * number, and none of which survives a numeric cast.
	 *
	 * @param path The validated attribute path.
	 * @returns The SQL expression.
	 */
	private attributeTextExpression(path: string): string {
		switch (this.dialect) {
			case 'postgres':
				return `doc.attributes ->> '${path}'`;
			case 'mysql':
				return `JSON_UNQUOTE(JSON_EXTRACT(doc.attributes, '$.${path}'))`;
			default:
				return `json_extract(doc.attributes, '$.${path}')`;
		}
	}

	/**
	 * The expression that reads one attribute out of the document's attribute map, for its kind.
	 *
	 * The expression used to be numeric for every attribute whatever its declaration said, and the
	 * value on the other side of the comparison was text for everything that is not a number or a
	 * boolean — so the two halves disagreed for four of the six kinds. On Postgres that is
	 * `ERROR 22P02: invalid input syntax for type numeric` or `operator does not exist: numeric >=
	 * text`; on MySQL it is a truncation to zero; on SQLite `CAST('2024-01-01T…' AS NUMERIC)` is
	 * `2024`, so every date in one year compared equal and the filter returned the wrong rows without
	 * an error anywhere. Reading the kind is what makes the two halves agree.
	 *
	 * A boolean is normalised to 1 or 0 rather than compared as text, because the three dialects
	 * disagree about what a JSON `true` extracts as: Postgres and MySQL yield the string `'true'` and
	 * SQLite's `json_extract` yields the integer `1`. {@link comparable} produces 1 or 0 for the
	 * value, and the `CASE` produces 1 or 0 for the column, so one predicate is right on all four.
	 *
	 * @param name The declared field name.
	 * @param kind The declared kind; a number when the caller is reading the document's own weight.
	 * @returns The SQL expression.
	 */
	private attributeExpression(name: string, kind: SearchFieldKind = SearchFieldKind.NUMBER): string {
		const path = this.safePath(name);
		const text = this.attributeTextExpression(path);

		if (kind === SearchFieldKind.NUMBER) {
			// A weight, a price or a quantity is compared as a number, and a decimal cast keeps the
			// comparison exact rather than approximate.
			return this.dialect === 'sqlite'
				? `CAST(${text} AS NUMERIC)`
				: `CAST(${text} AS DECIMAL(20,6))`;
		}

		if (kind === SearchFieldKind.BOOLEAN) {
			return `CASE WHEN ${text} IS NULL THEN NULL WHEN LOWER(${text}) IN ('true', '1', 't', 'yes') THEN 1 ELSE 0 END`;
		}

		return text;
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

		if (field.kind === SearchFieldKind.DATE && value instanceof Date) {
			// A `Date` rendered with `String()` is `Mon Dec 31 2024 …`, which does not compare
			// chronologically against the ISO-8601 text the document holds. GraphQL hands a parsed date
			// through, so this is the shape a range filter over a date arrives in on that surface.
			return value.toISOString();
		}

		return value === null || value === undefined ? '' : String(value);
	}

	/**
	 * Escapes the wildcards of a `LIKE` pattern.
	 *
	 * A parameterised pattern is safe from injection and completely open to a caller who types a
	 * wildcard into it: `%` matches anything and `_` matches one character, and both live in the
	 * *value* rather than in the statement. `q=%` produced `LIKE '%%%'`, which matches every document
	 * the caller may see — the term filter was bypassed wholesale and the index could be enumerated a
	 * page at a time.
	 *
	 * Every fragment that carries an escaped pattern states {@link LIKE_ESCAPE_CLAUSE}, because SQLite
	 * has no default escape character at all and the other two dialects' default is a backslash, which
	 * cannot be written portably inside a string literal.
	 *
	 * @param value The pattern fragment a caller supplied.
	 * @returns The fragment, with its wildcards and the escape character itself escaped.
	 */
	private escapeLike(value: string): string {
		return String(value ?? '').replace(/[!%_]/g, (character) => `${LIKE_ESCAPE}${character}`);
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
	 * Three things are handled here that were not:
	 *
	 * - MySQL's boolean mode reads `+`, `-`, `~` and `@` as **prefix** operators, and the `ALL` branch
	 *   already prefixes its own `+`. A term such as `-foo` therefore built `AGAINST ('+-foo*' IN
	 *   BOOLEAN MODE)`, which the server refuses with a syntax error — a search box turning a user's
	 *   typing into a 500. They are stripped from the front of a term and left inside it, so
	 *   `t-shirt` is still the word a person typed.
	 * - A term that is nothing but punctuation reached `to_tsquery`, which refuses it with
	 *   `syntax error in tsquery`. It is kept here — it is what the caller typed, and the portable
	 *   path can match it — and {@link isParsable} is what keeps it away from a text-search parser.
	 * - `%` and `_` are left in the term rather than removed, because they are legitimate characters
	 *   to search for; they are escaped where the term becomes a `LIKE` pattern. See
	 *   {@link escapeLike}.
	 *
	 * @param q The query.
	 * @returns The terms, lower-cased.
	 */
	private tokenise(q?: string): string[] {
		return String(q ?? '')
			.toLowerCase()
			.split(/\s+/)
			.map((term) =>
				term
					.replace(/[&|!()<>:*'\\"]/g, '')
					.replace(/^[+\-~@]+/, '')
					.trim()
			)
			.filter(Boolean);
	}

	/**
	 * Whether a term is one a dialect's own text-search parser will accept.
	 *
	 * `to_tsquery` and MySQL's boolean mode both parse their argument, and a term that carries no
	 * letter and no digit is not a lexeme to either of them — `to_tsquery('simple', ',')` raises
	 * `syntax error in tsquery`, which is a 500 produced by a search box. The term is not discarded;
	 * the *query* falls back to the portable path, which matches any character the caller typed.
	 *
	 * @param term The term.
	 * @returns True when a text-search parser can read it.
	 */
	private isParsable(term: string): boolean {
		return /[\p{L}\p{N}]/u.test(term);
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

		if (this.isRequestShaped(message)) {
			// A value the caller supplied was not one the column could hold. That is a fact about the
			// request, not about the connection, and degrading a capability over it lets unprivileged
			// input switch a feature off for every tenant of the process.
			return false;
		}

		if (context.useFullText && dialect !== 'sqlite' && /fulltext|match |against|tsquery|tsvector|searchvector/.test(message)) {
			this.degraded.set(`${dialect}:fulltext`, Date.now() + DEGRADED_CAPABILITY_TTL_MS);
			context.useFullText = false;

			this.logger.warn(
				`The ${dialect} full-text capability is unavailable, so the portable token match answers instead: ${message}`
			);

			return true;
		}

		// The trigger names the JSON capability itself. A bare `operator does not exist` used to be
		// enough, and that is the exact wording Postgres uses for an ordinary type mismatch between a
		// column and a parameter — a request-shaped failure, which is how one malformed filter could
		// disable JSON-path ranking and every attribute facet for the whole installation.
		if (context.useJsonPath && /json|jsonb|json_extract|json_unquote|jsonb_path|->>/.test(message)) {
			this.degraded.set(`${dialect}:json`, Date.now() + DEGRADED_CAPABILITY_TTL_MS);
			context.useJsonPath = false;

			this.logger.warn(
				`The ${dialect} JSON path capability is unavailable, so documents rank by their own weight: ${message}`
			);

			return true;
		}

		return false;
	}

	/**
	 * Whether a failure describes the request rather than the connection.
	 *
	 * A capability is degraded because the *connection* cannot do something, and a capability that is
	 * degraded stays degraded for every tenant of the process. So a failure that a caller's own value
	 * produced — a number that was not a number, a date that was not a date — must never be the thing
	 * that switches one off.
	 *
	 * @param message The lower-cased driver message.
	 * @returns True when the failure is about the request's values.
	 */
	private isRequestShaped(message: string): boolean {
		return /invalid input syntax|22p02|out of range|truncated incorrect|incorrect .* value|invalid text representation/.test(
			message
		);
	}
}
