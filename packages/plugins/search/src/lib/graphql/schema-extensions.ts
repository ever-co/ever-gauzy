import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of global search.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query` would be a duplicate definition and would fail
 * the schema build.
 *
 * `Decimal` carries weights and is never a `Float`: a weight is an exact value that is compared and
 * stored as one, and a binary fraction would let a re-weighting round into a different number than
 * the one an operator typed. Relevance `score` is a `Float` because it is a computed rank rather than
 * a stored amount, and it is never money.
 */
export const schemaExtensions = gql`
	"How the terms of a query are combined."
	enum SearchMatchMode {
		"Any term may match."
		ANY
		"Every term must match."
		ALL
		"The terms are matched as one phrase."
		PHRASE
	}

	"The predicate a filter applies to a declared field."
	enum SearchFilterOperator {
		EQ
		NEQ
		IN
		NIN
		GT
		GTE
		LT
		LTE
		CONTAINS
		STARTS_WITH
		BETWEEN
		EXISTS
	}

	"The direction of a sort key."
	enum SearchSortDirection {
		ASC
		DESC
	}

	"The kind of value a declared field holds, which decides how it is matched."
	enum SearchFieldKind {
		TEXT
		KEYWORD
		NUMBER
		DATE
		BOOLEAN
		ENTITY
	}

	"What a rebuild covers."
	enum SearchReindexScope {
		"Every active definition."
		ALL
		"One entity type."
		ENTITY
		"Every entity published to one channel."
		CHANNEL
	}

	"One predicate of a search."
	input SearchFilterInput {
		"The declared field name, or 'entity' to narrow the entity set."
		attribute: String!
		operator: SearchFilterOperator!
		"""
		The value to compare. A scalar for the comparison operators, a list for the set operators, and a
		two-element range for BETWEEN. It is a JSON scalar because the value's own type is the declared
		field's business: a price is compared as a decimal string, a flag as a boolean.
		"""
		value: JSON
		"The entity the attribute belongs to; required when one request filters across entity types."
		entity: String
	}

	"How a result set is ordered."
	input SearchSortInput {
		"'score' orders by relevance; anything else names a declared field."
		attribute: String!
		direction: SearchSortDirection
	}

	"A search request, in the terms every provider implements."
	input SearchInput {
		"The free-text query; empty means the request is filter-only."
		q: String
		"Entity keys to search; empty means every entity the caller may see."
		entities: [String!]
		matchMode: SearchMatchMode
		filters: [SearchFilterInput!]
		"Declared field names whose values are counted in the response's facets."
		facets: [String!]
		sort: SearchSortInput
		"How many hits to skip."
		skip: Int
		"How many hits to return."
		take: Int
		"Restricts the result to one channel's documents."
		channelId: ID
		"Explicit organization scope; the caller's own organization is used when it is absent."
		organizationId: ID
	}

	"One hit of a result set."
	type SearchHit {
		"The entity type the hit is an instance of."
		entity: String!
		"The id of the matched row. It is the reader's job to re-read the entity it names."
		entityId: ID!
		"The indexed title, produced by the declaration's title template."
		title: String!
		"Relevance, normalised at index time so it is comparable across entity types."
		score: Float!
		"The matched fragment, when the provider can produce one."
		highlight: String
		"""
		The declared attributes of the matched row, read from the entity itself rather than from the
		index. They are display values a listing renders; anything authoritative is read from the entity.
		"""
		attributes: JSON
	}

	"One value of a facet and how many hits carry it."
	type SearchFacetValue {
		value: String!
		count: Int!
	}

	"The value counts of one faceted attribute, on the page's own predicate."
	type SearchFacet {
		attribute: String!
		values: [SearchFacetValue!]!
	}

	"One type-ahead suggestion."
	type SearchSuggestion {
		"The completed text."
		text: String!
		"The entity type the suggestion belongs to."
		entity: String!
		"The row the suggestion names."
		entityId: ID!
	}

	"One ranked, faceted page of hits."
	type SearchResult {
		items: [SearchHit!]!
		"""
		How many hits matched. It counts what the caller may see: an entity the caller may not read is
		removed from the query rather than filtered out of its answer, so a total never reveals how many
		rows were withheld.
		"""
		total: Int!
		facets: [SearchFacet!]!
		"Entity types the caller may see, so a client can explain what was searched."
		searchedEntities: [String!]!
		pageInfo: PageInfo!
	}

	"How fresh one entity's index is."
	type SearchIndexStatus {
		entity: String!
		"The documents the index holds for the entity."
		indexedCount: Int!
		"Source rows that moved after the index last did."
		pendingCount: Int!
		lastIndexedAt: DateTime
		"How long ago the index last moved, in seconds."
		lagSeconds: Int
	}

	"One field of an entity that the index holds."
	type SearchIndexField {
		"Field name, unique inside its definition; the name a filter and a facet refer to."
		name: String!
		kind: SearchFieldKind!
		"Ranking multiplier, normalised into the document at index time."
		weight: Decimal!
		"Whether the field contributes to the free-text match."
		searchable: Boolean!
		"Whether the field may be used in a filter predicate."
		filterable: Boolean!
		"Whether the field's values are counted in a facet."
		facetable: Boolean!
		"The dotted path read on the entity; defaults to 'name'."
		source: String
	}

	"Which fields of which entity the index holds, and how much each of them counts."
	type SearchIndexDefinition {
		id: ID!
		"The entity key being indexed, in the platform's own vocabulary."
		entity: String!
		"Human readable name, used wherever searchable entities are listed."
		label: String!
		"The registered engine provider key; null means the built-in database provider."
		engineKey: String
		fields: [SearchIndexField!]!
		"The weight applied to a field that declares none."
		defaultWeight: Decimal!
		"Template producing the document title."
		titleTemplate: String
		"Template producing the document body."
		bodyTemplate: String
		"Which declared fields are promoted into the document's filterable token list."
		keywordFields: [String!]!
		"The column whose value is copied into the document's source timestamp."
		sourceUpdatedAtField: String!
		"An inactive definition is neither indexed nor queried; its documents are retained."
		isActive: Boolean!
		"A shipped definition: its weights may be edited, but it may not be deleted."
		isSystem: Boolean!
		"Bumped whenever the fields or a template change, so stale documents are rebuilt."
		version: Int!
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One field as an operator may re-weight it."
	input SearchIndexFieldInput {
		name: String!
		kind: SearchFieldKind!
		weight: Decimal
		searchable: Boolean
		filterable: Boolean
		facetable: Boolean
		source: String
	}

	"How an operator re-weights a definition."
	input SearchIndexDefinitionUpdateInput {
		label: String
		fields: [SearchIndexFieldInput!]
		titleTemplate: String
		bodyTemplate: String
		keywordFields: [String!]
		defaultWeight: Decimal
		sourceUpdatedAtField: String
		isActive: Boolean
	}

	"What a rebuild covers."
	input SearchReindexInput {
		scope: SearchReindexScope!
		"Required for the entity scope."
		entity: String
		"Required for the channel scope."
		channelId: ID
		"Rebuild only these source ids."
		ids: [ID!]
		"Rebuild only rows whose source moved after this moment."
		since: DateTime
	}

	"What one entity's rebuild did."
	type SearchIndexRun {
		entity: String!
		"How many documents were written."
		indexed: Int!
		"How many source rows could not be read and were skipped."
		skipped: Int!
		"How many documents were removed because their source row is gone."
		removed: Int!
		"How many batches the sweep took."
		batches: Int!
	}

	"The outcome of a rebuild."
	type SearchReindexPayload {
		"The entity that was rebuilt, when one was named."
		entity: String
		"Whether the platform accepted the work."
		queued: Boolean!
		"How many source rows the scope covers, counted before the sweep."
		estimatedCount: Int!
		"What each entity's run did."
		runs: [SearchIndexRun!]!
		userErrors: [UserError!]!
	}

	"The outcome of a change to an index definition."
	type SearchIndexDefinitionPayload {
		searchIndexDefinition: SearchIndexDefinition
		userErrors: [UserError!]!
	}

	"The outcome of removing an index definition."
	type DeleteSearchIndexDefinitionPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of dropping an index."
	type DropSearchIndexPayload {
		"How many documents were dropped."
		deletedCount: Int!
		userErrors: [UserError!]!
	}

	extend type Query {
		"Search every indexed entity the caller may see."
		search(input: SearchInput!, page: PageInput): SearchResult!
		"Type-ahead over the indexed entities."
		searchSuggest(q: String!, entities: [String!], limit: Int, channelId: ID): [SearchSuggestion!]!
		"Facet value counts for a filter set, on the same predicate a page would use."
		searchFacets(input: SearchInput!): [SearchFacet!]!
		"Which entity fields are indexed, with their weights."
		searchIndexDefinitions(entity: String): [SearchIndexDefinition!]!
		"One index definition."
		searchIndexDefinition(id: ID!): SearchIndexDefinition
		"Index freshness and document counts."
		searchIndexStatus(entities: [String!]): [SearchIndexStatus!]!
	}

	extend type Mutation {
		"Re-weights or deactivates an index definition."
		updateSearchIndexDefinition(id: ID!, input: SearchIndexDefinitionUpdateInput!): SearchIndexDefinitionPayload!
		"Removes a definition an operator authored; a shipped definition is refused."
		deleteSearchIndexDefinition(id: ID!): DeleteSearchIndexDefinitionPayload!
		"Rebuilds one entity's index."
		reindexEntity(entity: String!, input: SearchReindexInput): SearchReindexPayload!
		"Rebuilds every index, or every index of one channel."
		reindexAll(input: SearchReindexInput): SearchReindexPayload!
		"Drops the index of an entity, or of one channel."
		dropSearchIndex(entity: String, channelId: ID): DropSearchIndexPayload!
	}
`;
