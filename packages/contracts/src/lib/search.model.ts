import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { DecimalString } from './money.model';

/**
 * The kind of value an indexed field holds.
 *
 * The kind decides how a value is matched and whether it can be filtered or faceted, so a declaration
 * that states the wrong kind produces a search that silently never matches rather than one that
 * fails loudly.
 */
export enum SearchFieldKind {
	/** Free text, matched by the dialect's full-text capability where it exists. */
	TEXT = 'TEXT',
	/** An exact token: a code, a status, a slug, a foreign key. */
	KEYWORD = 'KEYWORD',
	NUMBER = 'NUMBER',
	DATE = 'DATE',
	BOOLEAN = 'BOOLEAN',
	/** The identifier of a related entity, carried for filtering and faceting. */
	ENTITY = 'ENTITY'
}

/**
 * One field of an entity that the index holds.
 *
 * A field is declared rather than inferred: the declaration says where the value is read from, how
 * much it counts towards relevance, and whether it may be filtered or faceted. Only a field marked
 * `searchable` contributes to the free-text match; the rest exist to narrow and to break down a
 * result set.
 */
export interface ISearchIndexField {
	/** Field name, unique inside its definition; the name a filter and a facet refer to. */
	name: string;
	kind: SearchFieldKind;
	/** Ranking multiplier. Normalised into the document at index time, so adding a field to one entity cannot reorder another. */
	weight: number;
	/** Whether the field contributes to the free-text match. */
	searchable: boolean;
	/** Whether the field may be used in a filter predicate. */
	filterable: boolean;
	/** Whether the field's values are counted in a facet. */
	facetable: boolean;
	/** Dotted path read on the entity; defaults to `name`. */
	source?: string;
}

/**
 * What the global index holds for one entity, and how it is built.
 *
 * The declaration is data, so an operator can re-weight a field, add a field or switch an entity off
 * without a deployment — and every domain is indexed through the same mechanism rather than through
 * an indexer of its own. `entity` is the value a search request passes as its entity filter.
 */
export interface ISearchIndexDefinition extends IBasePerTenantAndOrganizationEntityModel {
	/** Entity key in the platform's own vocabulary: `product`, `organization_contact`, `invoice`, … */
	entity: string;
	/** Human readable name used wherever searchable entities are listed. */
	label: string;
	/** Registered engine provider key; null means the built-in database provider. */
	engineKey?: string;
	/** The indexed field list. */
	fields: ISearchIndexField[];
	/**
	 * Weight applied to a field that declares none.
	 *
	 * An exact decimal, not a number: the column is a numeric and the driver returns it as a string,
	 * so declaring it as a number here would promise a type the row never carries. The same reason
	 * every other exact value on this platform is a decimal string.
	 */
	defaultWeight: DecimalString;
	/** Template producing the document title, for example `{{name}} — {{code}}`. */
	titleTemplate?: string;
	/** Template producing the document body; null joins the remaining searchable fields. */
	bodyTemplate?: string;
	/** Which indexed fields are promoted into the document's filterable token list. */
	keywordFields?: string[];
	/** The column whose value is copied into the document's `sourceUpdatedAt`. */
	sourceUpdatedAtField: string;
	/**
	 * An inactive definition is neither indexed nor queried; its documents are retained.
	 *
	 * Optional because the base entity every row extends declares it optional, with a database
	 * default of true — a definition that does not state it is active.
	 */
	isActive?: boolean;
	/** A seeded definition: its weights may be edited but it may not be deleted. */
	isSystem: boolean;
	/** Bumped whenever the fields or a template change, so stale documents are rebuilt. */
	version: number;
	metadata?: JsonData;
}

/**
 * One indexed entity instance, as the index holds it.
 *
 * A document is a projection and never authoritative: a hit carries an entity type and an id, and
 * every reader re-reads the entity from the domain that owns it. It is keyed by
 * `(tenant, entity, entityId, engine)`, so indexing the same row twice is an update rather than a
 * duplicate, and a full rebuild reproduces the same content.
 */
export interface ISearchDocument extends IBasePerTenantAndOrganizationEntityModel {
	/** Entity key, the same vocabulary as the index definition. */
	entity: string;
	/** Id of the indexed row; deliberately not a foreign key, because a projection outlives a hard delete. */
	entityId: ID;
	title: string;
	body?: string;
	/** Promoted tokens: facet values, codes, tags and the foreign keys the definition declared. */
	keywords?: string[];
	/** The attribute map of the row, which a filter reads where the dialect can index it. */
	attributes?: JsonData;
	/** The greatest `updatedAt` of the source row at index time; identifies a stale document. */
	sourceUpdatedAt?: Date;
	indexedAt: Date;
	/** Null when the built-in database provider wrote the row. */
	engineKey?: string;
	/** The definition version in force when the row was built. */
	definitionVersion: number;
}

/**
 * How the terms of a query are combined.
 */
export enum SearchMatchMode {
	/** A document matches when any term does. */
	ANY = 'ANY',
	/** A document matches only when every term does. */
	ALL = 'ALL',
	/** The terms are matched as one phrase. */
	PHRASE = 'PHRASE'
}

/**
 * The predicate a filter applies to a field.
 */
export enum SearchFilterOperator {
	EQ = 'EQ',
	NEQ = 'NEQ',
	IN = 'IN',
	NIN = 'NIN',
	GT = 'GT',
	GTE = 'GTE',
	LT = 'LT',
	LTE = 'LTE',
	CONTAINS = 'CONTAINS',
	STARTS_WITH = 'STARTS_WITH',
	BETWEEN = 'BETWEEN',
	EXISTS = 'EXISTS'
}

/**
 * One predicate of a search request.
 *
 * A filter names a declared field of the entity it applies to, so a filter that names a field no
 * definition declares is refused rather than silently matching nothing.
 */
export interface ISearchFilter {
	/** Declared field name, or `entity` to narrow the entity set. */
	attribute: string;
	operator: SearchFilterOperator;
	/** A scalar, or a list for the set operators, or a two-element range for `BETWEEN`. */
	value: string | number | boolean | Array<string | number>;
	/** Entity the attribute belongs to; required when one request filters across several entity types. */
	entity?: string;
}

export enum SearchSortDirection {
	ASC = 'ASC',
	DESC = 'DESC'
}

/**
 * How a result set is ordered.
 */
export interface ISearchSort {
	/** `score` orders by relevance; anything else names a declared field. */
	attribute: string;
	direction: SearchSortDirection;
}

/**
 * A search request, in the terms every provider implements.
 */
export interface ISearchRequest {
	/** The free-text query; empty means "filter only". */
	q: string;
	/** Entity keys to search; empty means every entity the caller may see. */
	entities?: string[];
	matchMode?: SearchMatchMode;
	filters?: ISearchFilter[];
	/** Declared field names whose values are counted in the response's facets. */
	facets?: string[];
	sort?: ISearchSort;
	/** How many hits to skip. */
	skip?: number;
	/** How many hits to return. */
	take?: number;
	/** Restricts the result to one channel's documents. */
	channelId?: ID;
	/** Explicit organization scope; the caller's own organization is used when it is absent. */
	organizationId?: ID;
}

/**
 * One hit of a result set.
 *
 * The hit carries what a listing needs to render and nothing more: the entity type, its id, the
 * indexed title, the relevance score and an optional highlight. Anything authoritative — a price, a
 * stock level, a balance, a status — is read from the entity, not from the index.
 */
export interface ISearchHit {
	entity: string;
	entityId: ID;
	title: string;
	/** Relevance, normalised at index time so it is comparable across entity types. */
	score: number;
	/** The matched fragment, when the provider can produce one. */
	highlight?: string;
	/** The indexed attributes, for a listing that renders a card without re-reading the entity. */
	attributes?: JsonData;
}

/**
 * One value of a facet and how many hits carry it.
 */
export interface ISearchFacetValue {
	value: string;
	count: number;
}

/**
 * The value counts of one faceted attribute.
 */
export interface ISearchFacet {
	attribute: string;
	values: ISearchFacetValue[];
}

/**
 * A merged, ranked, paginated result set.
 *
 * Ranking is comparable across entity types because weights are normalised when a document is
 * indexed rather than when it is queried, so adding a searchable entity does not silently reorder
 * the entities that were already there.
 */
export interface ISearchResult {
	items: ISearchHit[];
	total: number;
	facets: ISearchFacet[];
	/** Entity types the caller may see, so a client can explain what was searched. */
	searchedEntities: string[];
}

/**
 * One type-ahead suggestion.
 */
export interface ISearchSuggestion {
	text: string;
	entity: string;
	entityId: ID;
}

/**
 * How fresh one entity's index is.
 */
export interface ISearchIndexStatus {
	entity: string;
	indexedCount: number;
	/** Source rows whose document is missing or stale, as far as the platform can tell without a scan. */
	pendingCount: number;
	lastIndexedAt?: Date;
	lagSeconds?: number;
}

/**
 * What a provider reports about itself.
 */
export interface ISearchProviderHealth {
	key: string;
	healthy: boolean;
	/** Whether the provider is the built-in database one or an external engine. */
	external: boolean;
	detail?: string;
}

/**
 * The contract every search backend implements.
 *
 * One contract and two implementations: a database-backed provider that always works, and an
 * external engine that a deployment opts into. The platform never assumes an external engine is
 * present, and an unreachable engine falls back to the database provider rather than taking search
 * down with it.
 */
export interface ISearchProvider {
	/** Provider key; `database` is the built-in one. */
	readonly key: string;
	/** True when the provider is an external engine rather than the built-in database provider. */
	readonly external: boolean;
	/** Writes or replaces documents. */
	index(documents: ISearchDocument[]): Promise<number>;
	/** Removes documents by entity and id. */
	delete(entity: string, entityIds: ID[]): Promise<number>;
	/** Runs a query and returns a merged result set. */
	query(request: ISearchRequest, allowedEntities: string[]): Promise<ISearchResult>;
	/** Type-ahead over the same index. */
	suggest(request: ISearchRequest, allowedEntities: string[], limit: number): Promise<ISearchSuggestion[]>;
	/** Reports whether the backend is reachable and usable. */
	health(): Promise<ISearchProviderHealth>;
}

/**
 * What a reindex run is asked to rebuild.
 */
export enum SearchReindexScope {
	/** Every active definition. */
	ALL = 'ALL',
	/** One entity type. */
	ENTITY = 'ENTITY',
	/** Every entity published to one channel. */
	CHANNEL = 'CHANNEL'
}

/**
 * A reindex request.
 */
export interface ISearchReindexRequest {
	scope: SearchReindexScope;
	/** Required for the entity scope. */
	entity?: string;
	/** Required for the channel scope. */
	channelId?: ID;
	/** Rebuild only these source ids. */
	ids?: ID[];
	/** Rebuild only rows whose source moved after this moment. */
	since?: Date;
}

/**
 * What a reindex run accepted.
 */
export interface ISearchReindexResult {
	entity?: string;
	queued: boolean;
	estimatedCount: number;
}

/**
 * A registered search index declaration, as a package supplies it.
 *
 * Registration is how a domain makes an entity searchable: the package that owns the entity declares
 * the fields, the relations a hit preloads and the permission a caller needs to see a hit, and the
 * platform indexes it. Nothing about the entity is coded into the search package.
 */
export interface ISearchIndexRegistration {
	/** Entity key; the same vocabulary the definition rows and the requests use. */
	entity: string;
	label: string;
	fields: ISearchIndexField[];
	/** Relations preloaded when a declaration is materialised. */
	relations?: string[];
	/** The permission a caller must hold to see a hit of this entity type. */
	permission: string;
	/** Publication table whose rows decide the channels an entity is indexed for, when it is channel scoped. */
	channels?: string;
	titleTemplate?: string;
	bodyTemplate?: string;
	keywordFields?: string[];
	sourceUpdatedAtField?: string;
	defaultWeight?: number;
	/** True for a definition the platform ships, which may be re-weighted but not deleted. */
	isSystem?: boolean;
	/** Whether the declaration is active on a fresh installation. */
	isActive?: boolean;
}
