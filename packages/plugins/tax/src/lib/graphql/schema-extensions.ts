import { gql } from 'graphql-tag';

/**
 * The tax plugin's contribution to the platform's single GraphQL schema.
 *
 * The root types are declared once by the platform, so this file only extends them, and it declares no
 * type the platform already declares — `PageInfo`, `PageInput`, `SortDirection`, `DateTime`, `Decimal`
 * and `JSON` are core types and are referenced, never redeclared.
 *
 * A rate is a `Decimal` and never a `Float`: the serialiser is a string with six fractional digits, so a
 * rate read over GraphQL and a rate read over REST are the same string. The zone columns are nullable
 * because a rate that leaves one null admits anything at that level of the ladder, and `rates` is the
 * only relation: the conditional rules of a rate are `rule` rows whose `ownerType` is `TAX_RATE`, and
 * they are read through the rule resource rather than as a field of a rate.
 */
export const schemaExtensions = gql`
	extend type Query {
		taxCategories(
			filter: TaxCategoryFilter
			sort: [TaxCategorySort!]
			page: PageInput
			first: Int
			after: String
			last: Int
			before: String
			limit: Int
			offset: Int
			withDeleted: Boolean
		): TaxCategoryConnection!
		taxCategory(id: ID!): TaxCategory
		taxRates(
			filter: TaxRateFilter
			sort: [TaxRateSort!]
			page: PageInput
			first: Int
			after: String
			last: Int
			before: String
			limit: Int
			offset: Int
			withDeleted: Boolean
		): TaxRateConnection!
		taxRate(id: ID!): TaxRate
		"Resolves the rates that apply to a destination, most specific zone first."
		resolveTaxRate(input: ResolveTaxRateInput!): [ResolvedTaxRate!]!
	}

	extend type Mutation {
		createTaxCategory(input: CreateTaxCategoryInput!): TaxCategory!
		updateTaxCategory(input: UpdateTaxCategoryInput!): TaxCategory!
		"Retires a category; the row is kept, because its rates are what placed tax lines point at."
		deleteTaxCategory(id: ID!): TaxCategory!
		createTaxRate(input: CreateTaxRateInput!): TaxRate!
		updateTaxRate(input: UpdateTaxRateInput!): TaxRate!
		"Retires a rate; the row is kept, because placed tax lines name it."
		deleteTaxRate(id: ID!): TaxRate!
	}

	"The taxable class of the things an organization sells and of the parties it sells to."
	type TaxCategory {
		id: ID!
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		deletedAt: DateTime
		isActive: Boolean
		isArchived: Boolean
		name: String!
		code: String!
		description: String
		"Whether this is the category an organization applies to anything that names none."
		isDefault: Boolean!
		metadata: JSON
		"The rates of the category, in the order the resolver reads them."
		rates: [TaxRate!]
	}

	"One rate of one category, scoped geographically and in time."
	type TaxRate {
		id: ID!
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		deletedAt: DateTime
		isActive: Boolean
		isArchived: Boolean
		taxCategoryId: ID!
		taxCategory: TaxCategory
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		"The rate as a fraction, serialised at six decimal places. Never a Float."
		rate: Decimal!
		name: String!
		code: String
		isCompound: Boolean!
		isInclusive: Boolean
		isDefault: Boolean!
		priority: Int!
		providerKey: String
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"One rate of a resolved chain, as it will be applied to a document."
	type ResolvedTaxRate {
		"The rate row this came from; null only for the legacy per-variant fallback."
		taxRateId: ID
		taxCategoryId: ID!
		code: String
		name: String!
		rate: Decimal!
		isCompound: Boolean!
		isInclusive: Boolean!
		priority: Int!
		providerKey: String
		"The level of the ladder the rate won at."
		matchLevel: TaxRateMatchLevel!
		"True for the rate the ladder stopped at; the compound rates of the chain follow it."
		isWinner: Boolean!
	}

	"How specific the zone of a resolved rate is."
	enum TaxRateMatchLevel {
		COUNTRY_PROVINCE_POSTAL
		COUNTRY_PROVINCE
		COUNTRY
		REGION
		DEFAULT
	}

	enum TaxCategorySortField {
		NAME
		CODE
		IS_DEFAULT
		CREATED_AT
		UPDATED_AT
	}

	input TaxCategorySort {
		field: TaxCategorySortField!
		direction: SortDirection!
	}

	enum TaxRateSortField {
		PRIORITY
		RATE
		NAME
		CODE
		COUNTRY_CODE
		STARTS_AT
		CREATED_AT
		UPDATED_AT
	}

	input TaxRateSort {
		field: TaxRateSortField!
		direction: SortDirection!
	}

	input TaxCategoryFilter {
		ids: [ID!]
		code: String
		name: String
		isDefault: Boolean
		isActive: Boolean
		"Matched against the name and the code."
		search: String
	}

	input TaxRateFilter {
		ids: [ID!]
		taxCategoryId: ID
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		code: String
		name: String
		providerKey: String
		isCompound: Boolean
		isInclusive: Boolean
		isDefault: Boolean
		isActive: Boolean
		"Only the rates whose validity window contains this moment."
		liveAt: DateTime
	}

	type TaxCategoryEdge {
		node: TaxCategory!
		cursor: String!
	}

	type TaxCategoryConnection {
		nodes: [TaxCategory!]!
		edges: [TaxCategoryEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type TaxRateEdge {
		node: TaxRate!
		cursor: String!
	}

	type TaxRateConnection {
		nodes: [TaxRate!]!
		edges: [TaxRateEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	input CreateTaxCategoryInput {
		name: String!
		code: String!
		description: String
		isDefault: Boolean
		organizationId: ID
		metadata: JSON
	}

	input UpdateTaxCategoryInput {
		id: ID!
		name: String
		code: String
		description: String
		isDefault: Boolean
		metadata: JSON
	}

	input CreateTaxRateInput {
		taxCategoryId: ID!
		name: String!
		"The rate as a fraction — 0.2 is twenty percent."
		rate: Decimal!
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		code: String
		isCompound: Boolean
		isInclusive: Boolean
		isDefault: Boolean
		priority: Int
		providerKey: String
		startsAt: DateTime
		endsAt: DateTime
		organizationId: ID
		metadata: JSON
	}

	input UpdateTaxRateInput {
		id: ID!
		taxCategoryId: ID
		name: String
		rate: Decimal
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		code: String
		isCompound: Boolean
		isInclusive: Boolean
		isDefault: Boolean
		priority: Int
		providerKey: String
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	input ResolveTaxRateInput {
		taxCategoryId: ID
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCode: String
		regionTaxInclusive: Boolean
		"The moment the rates' validity windows are evaluated at; the current time when omitted."
		at: DateTime
	}
`;
