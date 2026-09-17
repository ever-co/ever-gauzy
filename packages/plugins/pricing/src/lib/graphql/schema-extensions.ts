import { gql } from 'graphql-tag';

/**
 * The pricing domain's contribution to the platform schema.
 *
 * `Query`, `Mutation` and the shared scalars are declared by the kernel and extended here: a root
 * operation type exists once for the whole platform, so a domain adds fields to it and never
 * declares its own. Everything this document declares is additive, which is what keeps the schema a
 * monotonically growing artefact.
 *
 * Money is `Decimal`, never `Float`: `Decimal` is an exact decimal serialised as a string with six
 * fractional digits, matching the wire format of a `numeric(20,6)` column, so a price read here and
 * the same price read over REST are string-identical. A `Float` cannot hold a cent exactly, and a
 * price that rounds differently on two surfaces is a defect a customer notices.
 *
 * The filter inputs are built from the kernel's filter family, so a caller learns the operator
 * vocabulary once and every domain speaks it. The connection fields follow the kernel's pagination
 * vocabulary: `page` walks with cursors, `limit`/`offset` walks by page, and the two are not mixed
 * in one request.
 */
export const schemaExtensions = gql`
	extend type Query {
		"Price lists of the caller's organization, most useful first."
		priceLists(
			filter: PriceListFilter
			sort: PriceListSort
			page: PageInput
			limit: Int
			offset: Int
		): PriceListConnection!
		"One price list by its identifier."
		priceList(id: ID!): PriceList
		"Price rows of the caller's organization."
		productPrices(
			filter: ProductPriceFilter
			sort: ProductPriceSort
			page: PageInput
			limit: Int
			offset: Int
		): ProductPriceConnection!
		"One price row by its identifier."
		productPrice(id: ID!): ProductPrice
		"Tax-inclusivity preferences of the caller's organization."
		pricePreferences(
			filter: PricePreferenceFilter
			sort: PricePreferenceSort
			page: PageInput
			limit: Int
			offset: Int
		): PricePreferenceConnection!
		"One tax-inclusivity preference by its identifier."
		pricePreference(id: ID!): PricePreference
		"Foreign-exchange rates of the caller's organization."
		exchangeRates(
			filter: ExchangeRateFilter
			sort: ExchangeRateSort
			page: PageInput
			limit: Int
			offset: Int
		): ExchangeRateConnection!
		"One exchange rate by its identifier."
		exchangeRate(id: ID!): ExchangeRate
		"""
		The effective price of each requested variant for one context.

		A variant with no price configured is omitted from the result rather than resolved to zero: a
		missing price is a configuration gap to report, never a free product. A variant priced by the
		legacy variant retail price is returned with \`source: VARIANT_RETAIL_PRICE\`, so a caller can
		tell a real price from a fallback.
		"""
		resolvePrice(input: ResolvePriceInput!): [ResolvedPrice!]!
	}

	extend type Mutation {
		"Create a price list."
		createPriceList(input: CreatePriceListInput!): PriceList!
		"Update a price list."
		updatePriceList(input: UpdatePriceListInput!): PriceList!
		"Delete a price list, softly unless \`force\` is set."
		deletePriceList(id: ID!, force: Boolean): DeletePriceListPayload!
		"Publish a built price list, so that its prices begin to resolve."
		activatePriceList(id: ID!): PriceList!
		"Withdraw a price list without deleting it or the prices it carries."
		expirePriceList(id: ID!): PriceList!
		"Create a price row: a default price, a tiered price, a list price or a scheduled one."
		createProductPrice(input: CreateProductPriceInput!): ProductPrice!
		"Update a price row."
		updateProductPrice(input: UpdateProductPriceInput!): ProductPrice!
		"Delete a price row, softly unless \`force\` is set."
		deleteProductPrice(id: ID!, force: Boolean): DeleteProductPricePayload!
		"Write a price matrix, reporting the rows that were refused."
		bulkUpsertProductPrices(input: BulkUpsertProductPricesInput!): BulkUpsertProductPricesPayload!
		"Change the answer a scope gives about tax-inclusive presentation."
		updatePricePreference(input: UpdatePricePreferenceInput!): PricePreference!
		"Create an exchange rate."
		createExchangeRate(input: CreateExchangeRateInput!): ExchangeRate!
		"Update an exchange rate."
		updateExchangeRate(input: UpdateExchangeRateInput!): ExchangeRate!
		"Delete an exchange rate, softly unless \`force\` is set."
		deleteExchangeRate(id: ID!, force: Boolean): DeleteExchangeRatePayload!
	}

	"A named, scoped, time-boxed set of prices."
	type PriceList {
		id: ID!
		tenantId: ID
		organizationId: ID
		name: String!
		code: String!
		description: String
		"Whether the list competes on price or wins outright for its context."
		type: PriceListType!
		status: PriceListStatus!
		"Higher wins between two eligible lists."
		priority: Int!
		"Currency the list's prices are expressed in; null applies to any currency."
		currency: String
		channelId: ID
		customerGroupId: ID
		regionId: ID
		startsAt: DateTime
		endsAt: DateTime
		isTaxInclusive: Boolean!
		metadata: JSON
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"The price of one product variant."
	type ProductPrice {
		id: ID!
		tenantId: ID
		organizationId: ID
		"Null is the default price of the variant, used when no price list wins."
		priceListId: ID
		variantId: ID!
		currency: String!
		amount: Decimal!
		"""
		Display-only "was" price. It never enters a total.
		"""
		compareAtAmount: Decimal
		"Cost snapshot the margin guard reads. It never enters a total."
		costAmount: Decimal
		"Lower bound of the quantity band; null is open."
		minQuantity: Decimal
		"Upper bound of the quantity band; null is open."
		maxQuantity: Decimal
		"Null inherits from the price list, then from a price preference."
		taxInclusive: Boolean
		"Margin floor as a fraction, e.g. 0.250000 for 25 %."
		minMarginPercent: Decimal
		"Discount ceiling as a fraction, e.g. 0.300000 for 30 %."
		maxDiscountPercent: Decimal
		status: PriceStatus!
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"How one scope presents prices."
	type PricePreference {
		id: ID!
		tenantId: ID
		organizationId: ID
		attribute: PricePreferenceAttribute!
		"An ISO currency code, a region id or code, or a channel code."
		value: String!
		isTaxInclusive: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"The conversion between two currencies, valid from an instant."
	type ExchangeRate {
		id: ID!
		tenantId: ID
		organizationId: ID
		fromCurrency: String!
		toCurrency: String!
		rate: Decimal!
		"Rate source; null means it was entered by hand."
		providerKey: String
		validFrom: DateTime!
		validUntil: DateTime
		isManual: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"The effective price of one variant for one context."
	type ResolvedPrice {
		variantId: ID!
		"The winning \`product_price\` row, absent when the legacy retail price was used."
		priceId: ID
		"The winning price list, absent for a default price or the legacy fallback."
		priceListId: ID
		currency: String!
		"What one unit costs."
		amount: Decimal!
		"What it would cost without the winning list, when that is a real reduction."
		originalAmount: Decimal
		compareAtAmount: Decimal
		taxInclusive: Boolean!
		source: PriceSource!
		"The conditions the resolution applied, for an operator reading the decision."
		matchedRules: [String!]!
		"A human-readable account of the decision."
		explain: String!
	}

	"How a price list competes for a context."
	enum PriceListType {
		"Competes on price: wins only when its resolved price is lower than the default price."
		SALE
		"Wins outright for its context, whatever the default price is."
		OVERRIDE
	}

	"The lifecycle of a price list."
	enum PriceListStatus {
		"Being built. Not eligible for resolution."
		DRAFT
		"Eligible for resolution inside its window."
		ACTIVE
		"Deliberately withdrawn; its prices are retained and resolve to nothing."
		INACTIVE
	}

	"The lifecycle of a single price row."
	enum PriceStatus {
		"Prepared, not yet offered. Excluded from resolution."
		DRAFT
		"Eligible for resolution."
		ACTIVE
		"Retained for history, excluded from resolution."
		INACTIVE
	}

	"The scope a tax-inclusivity preference is keyed by."
	enum PricePreferenceAttribute {
		"Keyed by an ISO 4217 currency code."
		CURRENCY
		"Keyed by a region id or region code."
		REGION
		"Keyed by a channel code."
		CHANNEL
	}

	"Where a resolved amount came from."
	enum PriceSource {
		"A price row belonging to an eligible price list."
		PRICE_LIST
		"A price row with no price list: the default price of the variant."
		DEFAULT_PRICE
		"No price row was eligible, so the legacy variant retail price was used."
		VARIANT_RETAIL_PRICE
	}

	"How a bulk price upsert treats the rows it was not given."
	enum PriceBulkMode {
		"Write exactly the rows supplied and leave every other row alone."
		UPSERT
		"Also retire the rows of the mentioned pairs that were not supplied."
		REPLACE
	}

	"A page of price lists."
	type PriceListConnection {
		items: [PriceList!]!
		total: Int!
		pageInfo: PageInfo!
	}

	"A page of price rows."
	type ProductPriceConnection {
		items: [ProductPrice!]!
		total: Int!
		pageInfo: PageInfo!
	}

	"A page of tax-inclusivity preferences."
	type PricePreferenceConnection {
		items: [PricePreference!]!
		total: Int!
		pageInfo: PageInfo!
	}

	"A page of exchange rates."
	type ExchangeRateConnection {
		items: [ExchangeRate!]!
		total: Int!
		pageInfo: PageInfo!
	}

	"What deleting a price list did."
	type DeletePriceListPayload {
		id: ID!
		deleted: Boolean!
		"True when the row was removed outright, false when it was soft-deleted."
		hard: Boolean!
	}

	"What deleting a price row did."
	type DeleteProductPricePayload {
		id: ID!
		deleted: Boolean!
		"True when the row was removed outright, false when it was soft-deleted."
		hard: Boolean!
	}

	"What deleting an exchange rate did."
	type DeleteExchangeRatePayload {
		id: ID!
		deleted: Boolean!
		"True when the row was removed outright, false when it was soft-deleted."
		hard: Boolean!
	}

	"What a bulk price upsert did, row by row."
	type BulkUpsertProductPricesPayload {
		succeeded: [ProductPrice!]!
		failed: [BulkPriceFailure!]!
		succeededCount: Int!
		failedCount: Int!
	}

	"One row of a bulk price batch that was refused."
	type BulkPriceFailure {
		"The row's position in the batch, from zero."
		index: Int!
		variantId: ID
		"Why the row was refused."
		message: String!
	}

	"How to narrow a list of price lists."
	input PriceListFilter {
		ids: [ID!]
		code: String
		name: String
		type: PriceListType
		status: PriceListStatus
		currency: String
		channelId: ID
		customerGroupId: ID
		regionId: ID
		isTaxInclusive: Boolean
	}

	"How to order a list of price lists."
	input PriceListSort {
		field: PriceListSortField!
		direction: SortDirection
	}

	"The sortable fields of a price list."
	enum PriceListSortField {
		NAME
		CODE
		PRIORITY
		STATUS
		STARTS_AT
		ENDS_AT
		CREATED_AT
		UPDATED_AT
	}

	"How to narrow a list of price rows."
	input ProductPriceFilter {
		ids: [ID!]
		variantId: ID
		variantIds: [ID!]
		priceListId: ID
		currency: String
		status: PriceStatus
	}

	"How to order a list of price rows."
	input ProductPriceSort {
		field: ProductPriceSortField!
		direction: SortDirection
	}

	"The sortable fields of a price row."
	enum ProductPriceSortField {
		AMOUNT
		MIN_QUANTITY
		STATUS
		CREATED_AT
		UPDATED_AT
	}

	"How to narrow a list of tax-inclusivity preferences."
	input PricePreferenceFilter {
		ids: [ID!]
		attribute: PricePreferenceAttribute
		value: String
	}

	"How to order a list of tax-inclusivity preferences."
	input PricePreferenceSort {
		field: PricePreferenceSortField!
		direction: SortDirection
	}

	"The sortable fields of a tax-inclusivity preference."
	enum PricePreferenceSortField {
		ATTRIBUTE
		VALUE
		CREATED_AT
		UPDATED_AT
	}

	"How to narrow a list of exchange rates."
	input ExchangeRateFilter {
		ids: [ID!]
		fromCurrency: String
		toCurrency: String
		isManual: Boolean
	}

	"How to order a list of exchange rates."
	input ExchangeRateSort {
		field: ExchangeRateSortField!
		direction: SortDirection
	}

	"The sortable fields of an exchange rate."
	enum ExchangeRateSortField {
		FROM_CURRENCY
		TO_CURRENCY
		VALID_FROM
		RATE
		CREATED_AT
	}

	"The fields a price list is created with."
	input CreatePriceListInput {
		organizationId: ID
		name: String!
		code: String!
		description: String
		type: PriceListType
		status: PriceListStatus
		priority: Int
		currency: String
		channelId: ID
		customerGroupId: ID
		regionId: ID
		startsAt: DateTime
		endsAt: DateTime
		isTaxInclusive: Boolean
		metadata: JSON
	}

	"The fields a price list is updated with. Only what is sent changes."
	input UpdatePriceListInput {
		id: ID!
		name: String
		code: String
		description: String
		type: PriceListType
		status: PriceListStatus
		priority: Int
		currency: String
		channelId: ID
		customerGroupId: ID
		regionId: ID
		startsAt: DateTime
		endsAt: DateTime
		isTaxInclusive: Boolean
		metadata: JSON
	}

	"The fields a price row is created with."
	input CreateProductPriceInput {
		organizationId: ID
		variantId: ID!
		priceListId: ID
		currency: String!
		amount: Decimal!
		compareAtAmount: Decimal
		costAmount: Decimal
		minQuantity: Decimal
		maxQuantity: Decimal
		taxInclusive: Boolean
		minMarginPercent: Decimal
		maxDiscountPercent: Decimal
		status: PriceStatus
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"""
	The fields a price row is updated with.

	\`variantId\` is deliberately absent: a price's variant is part of its identity, and re-pointing a
	tier at another variant would leave that variant's other bands knowing nothing about it. Delete
	and re-create instead.
	"""
	input UpdateProductPriceInput {
		id: ID!
		priceListId: ID
		currency: String
		amount: Decimal
		compareAtAmount: Decimal
		costAmount: Decimal
		minQuantity: Decimal
		maxQuantity: Decimal
		taxInclusive: Boolean
		minMarginPercent: Decimal
		maxDiscountPercent: Decimal
		status: PriceStatus
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"One row of a bulk price batch."
	input ProductPriceBulkItemInput {
		id: ID
		variantId: ID!
		priceListId: ID
		currency: String!
		amount: Decimal!
		minQuantity: Decimal
		maxQuantity: Decimal
		status: PriceStatus
	}

	"A price matrix to write."
	input BulkUpsertProductPricesInput {
		organizationId: ID
		items: [ProductPriceBulkItemInput!]!
		mode: PriceBulkMode
		"""
		When set, the whole batch is validated before the first row is written, so a refused row
		writes nothing at all.
		"""
		atomic: Boolean
	}

	"The answer a scope gives about tax-inclusive presentation."
	input UpdatePricePreferenceInput {
		id: ID!
		isTaxInclusive: Boolean!
	}

	"The fields an exchange rate is created with."
	input CreateExchangeRateInput {
		organizationId: ID
		fromCurrency: String!
		toCurrency: String!
		rate: Decimal!
		providerKey: String
		validFrom: DateTime!
		validUntil: DateTime
		isManual: Boolean
	}

	"""
	The fields an exchange rate is updated with.

	The pair and the instant the rate became valid are the row's business key and are therefore
	absent: correcting a rate entered wrongly for a moment is a delete and a re-create, which is also
	what keeps the "greatest \`validFrom\` wins" lookup unambiguous.
	"""
	input UpdateExchangeRateInput {
		id: ID!
		rate: Decimal
		providerKey: String
		validUntil: DateTime
		isManual: Boolean
	}

	"The context a price is resolved against."
	input ResolvePriceInput {
		variantIds: [ID!]!
		currency: String!
		"Units being priced. Quantity bands are selected by it; defaults to one."
		quantity: Decimal
		channelId: ID
		regionId: ID
		customerId: ID
		customerGroupIds: [ID!]
		"The instant the price must be valid at; defaults to now."
		date: DateTime
	}
`;
