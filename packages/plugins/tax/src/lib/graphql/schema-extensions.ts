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
		"The ordered parts one rate is made of; an empty list is the rate's one implied part."
		taxRateParts(id: ID!): [TaxRatePart!]!
		"Resolves the rates that apply to a destination, most specific zone first."
		resolveTaxRate(input: ResolveTaxRateInput!): [ResolvedTaxRate!]!
		taxRegimes(
			filter: TaxRegimeFilter
			sort: [TaxRegimeSort!]
			page: PageInput
			first: Int
			after: String
			last: Int
			before: String
			limit: Int
			offset: Int
			withDeleted: Boolean
		): TaxRegimeConnection!
		taxRegime(id: ID!): TaxRegime
		"The rates one regime selects."
		taxRegimeRates(id: ID!): [TaxRegimeRate!]!
		"Resolves the regime a document is taxed under, from the party's assignment and then the destination."
		resolveTaxRegime(input: ResolveTaxRegimeInput!): ResolvedTaxRegime
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
		"Replaces the ordered parts of a rate; an empty list returns it to its implied part."
		setTaxRateParts(input: SetTaxRatePartsInput!): [TaxRatePart!]!
		createTaxRegime(input: CreateTaxRegimeInput!): TaxRegime!
		updateTaxRegime(input: UpdateTaxRegimeInput!): TaxRegime!
		"Retires a regime; the row is kept, because placed tax lines record the set they were taxed under."
		deleteTaxRegime(id: ID!): TaxRegime!
		"Sets which rates a regime selects. A regime that selects nothing is refused."
		setTaxRegimeRates(input: SetTaxRegimeRatesInput!): [TaxRegimeRate!]!
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
		"The arithmetic of the rate, which its parts may override."
		amountType: TaxAmountType!
		"The side of a document the rate applies to."
		direction: TaxDirection!
		"The ordered parts the rate is made of; one implied part when it declares none."
		parts: [TaxRatePart!]
		providerKey: String
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"One part of a rate: a base, a signed share of the rate and an optional posting code."
	type TaxRatePart {
		id: ID!
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		deletedAt: DateTime
		isActive: Boolean
		isArchived: Boolean
		taxRateId: ID!
		"The order the part is applied in; a compound rate's base is the rounded amounts of the parts before it."
		sequence: Int!
		"Whether the part declares a base or produces an amount."
		partType: TaxPartType!
		"Signed share of the rate's computed amount this part carries, at six decimal places."
		factorPercent: Decimal!
		"Share of the owner's net-after-discount this part is computed on."
		baseFactor: Decimal!
		"How the part arrives at its amount."
		amountType: TaxAmountType!
		"The amount contributed per unit of the owner's quantity, for a fixed part."
		fixedAmount: Decimal
		"Currency of the fixed amount."
		fixedCurrency: String
		"The code the receiving accounting system posts this part under. Not an account."
		postingKey: String
		"Printed name of the part; falls back to the rate's name."
		label: String
		metadata: JSON
	}

	"The named set of rates a party or a destination switches to."
	type TaxRegime {
		id: ID!
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		deletedAt: DateTime
		isActive: Boolean
		isArchived: Boolean
		name: String!
		code: String!
		"Tie-break among equally specific regimes; the higher priority wins."
		priority: Int!
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		"Whether the regime applies only when the party states a usable registration number."
		requiresPartyTaxRegistration: Boolean!
		startsAt: DateTime
		endsAt: DateTime
		description: String
		metadata: JSON
		"The rates the regime selects."
		rates: [TaxRegimeRate!]
	}

	"The membership of one rate in one regime. Its presence is what makes a rate regime-specific."
	type TaxRegimeRate {
		id: ID!
		organizationId: ID
		createdAt: DateTime
		updatedAt: DateTime
		taxRegimeId: ID!
		taxRateId: ID!
	}

	"One part of a resolved rate, as it will be applied to a document."
	type ResolvedTaxPart {
		"The part row this came from; null for the implied part of a rate that declares none."
		taxRatePartId: ID
		sequence: Int!
		partType: TaxPartType!
		factorPercent: Decimal!
		baseFactor: Decimal!
		amountType: TaxAmountType!
		fixedAmount: Decimal
		fixedCurrency: String
		postingKey: String
		label: String
	}

	"The regime a document is taxed under."
	type ResolvedTaxRegime {
		taxRegimeId: ID!
		code: String
		name: String
		priority: Int!
		"How the regime was chosen: the party's assignment, or the most specific matching level."
		matchLevel: TaxRegimeMatchLevel!
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
		amountType: TaxAmountType!
		direction: TaxDirection!
		"The ordered parts the rate is applied through."
		parts: [ResolvedTaxPart!]!
		providerKey: String
		"The level of the ladder the rate won at."
		matchLevel: TaxRateMatchLevel!
		"True for the rate the ladder stopped at; the compound rates of the chain follow it."
		isWinner: Boolean!
	}

	"What a part of a rate does with its share of the rate."
	enum TaxPartType {
		BASE
		TAX
	}

	"How a rate or a part of one arrives at its amount."
	enum TaxAmountType {
		PERCENT
		FIXED
	}

	"The side of a document a rate applies to."
	enum TaxDirection {
		SALE
		PURCHASE
		BOTH
	}

	"How a regime was chosen for a document."
	enum TaxRegimeMatchLevel {
		PARTY_OVERRIDE
		COUNTRY_PROVINCE_POSTAL
		COUNTRY_PROVINCE
		COUNTRY
		REGION
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
		DIRECTION
		STARTS_AT
		CREATED_AT
		UPDATED_AT
	}

	input TaxRateSort {
		field: TaxRateSortField!
		direction: SortDirection!
	}

	enum TaxRegimeSortField {
		PRIORITY
		NAME
		CODE
		STARTS_AT
		CREATED_AT
		UPDATED_AT
	}

	input TaxRegimeSort {
		field: TaxRegimeSortField!
		direction: SortDirection!
	}

	input TaxRegimeFilter {
		ids: [ID!]
		code: String
		name: String
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		requiresPartyTaxRegistration: Boolean
		isActive: Boolean
		"Only the regimes whose validity window contains this moment."
		liveAt: DateTime
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
		amountType: TaxAmountType
		direction: TaxDirection
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

	type TaxRegimeEdge {
		node: TaxRegime!
		cursor: String!
	}

	type TaxRegimeConnection {
		nodes: [TaxRegime!]!
		edges: [TaxRegimeEdge!]!
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
		"The arithmetic of the rate; a percentage when it is omitted."
		amountType: TaxAmountType
		"The side of a document the rate applies to; a sale when it is omitted."
		direction: TaxDirection
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
		amountType: TaxAmountType
		direction: TaxDirection
		providerKey: String
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	input ResolveTaxRateInput {
		taxCategoryId: ID
		"The regime assigned to the party; the destination is matched when it is omitted."
		taxRegimeId: ID
		"Whether the party states a usable registration number, which a regime may require."
		partyTaxRegistrationPresent: Boolean
		"The side of the document being taxed; a sale when it is omitted."
		documentDirection: TaxDirection
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCode: String
		regionTaxInclusive: Boolean
		"The moment the rates' validity windows are evaluated at; the current time when omitted."
		at: DateTime
	}

	"One part of a rate, as a caller supplies it when a breakdown is written."
	input TaxRatePartInput {
		sequence: Int
		partType: TaxPartType
		"Signed share of the rate's computed amount this part carries."
		factorPercent: Decimal!
		"Share of the owner's net-after-discount this part is computed on."
		baseFactor: Decimal
		amountType: TaxAmountType
		fixedAmount: Decimal
		fixedCurrency: String
		postingKey: String
		label: String
		metadata: JSON
	}

	input SetTaxRatePartsInput {
		id: ID!
		"The complete ordered list; an empty list returns the rate to its one implied part."
		parts: [TaxRatePartInput!]!
	}

	input CreateTaxRegimeInput {
		name: String!
		code: String!
		priority: Int
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		requiresPartyTaxRegistration: Boolean
		startsAt: DateTime
		endsAt: DateTime
		description: String
		organizationId: ID
		metadata: JSON
	}

	input UpdateTaxRegimeInput {
		id: ID!
		name: String
		code: String
		priority: Int
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCodePattern: String
		requiresPartyTaxRegistration: Boolean
		startsAt: DateTime
		endsAt: DateTime
		description: String
		metadata: JSON
	}

	input SetTaxRegimeRatesInput {
		id: ID!
		"The complete set of rates the regime selects; an empty set is refused."
		taxRateIds: [ID!]!
	}

	input ResolveTaxRegimeInput {
		"The regime assigned to the party; the destination is matched when it is omitted."
		taxRegimeId: ID
		partyTaxRegistrationPresent: Boolean
		regionId: ID
		countryCode: String
		provinceCode: String
		postalCode: String
		"The moment the regimes' validity windows are evaluated at; the current time when omitted."
		at: DateTime
	}
`;
