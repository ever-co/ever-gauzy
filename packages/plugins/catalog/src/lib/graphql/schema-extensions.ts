import { gql } from 'graphql-tag';

/**
 * The catalog plugin's contribution to the platform schema.
 *
 * The type names are the concepts' own names, and a field name matches the entity property it is read
 * from, so a REST caller and a GraphQL caller read the same vocabulary. Two of the tables carry a name
 * that differs from their type on purpose: `product_channel` is served as `ProductPublication` and
 * `product_variant_channel` as `ProductVariantPublication`, because inside one schema a "publication"
 * is unambiguous while a "product channel" would read as the channel itself.
 */
export const schemaExtensions = gql`
	enum PublicationStatus {
		DRAFT
		ACTIVE
		ARCHIVED
	}

	enum CollectionType {
		MANUAL
		RULE_BASED
		HYBRID
	}

	enum ProductRelationType {
		RELATED
		UPSELL
		CROSS_SELL
		ACCESSORY
		SPARE_PART
	}

	type Collection {
		id: ID!
		name: String!
		slug: String!
		description: String
		type: CollectionType!
		status: PublicationStatus!
		sortOrder: Int!
		isFeatured: Boolean!
		startsAt: DateTime
		endsAt: DateTime
		publishedAt: DateTime
		imageAssetId: ID
		parentId: ID
		customerId: ID
		parent: Collection
		children: [Collection!]
		products: [CollectionProduct!]
		variants: [CollectionVariant!]
		channelPublications: [CollectionChannel!]
		metadata: JSON
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type CollectionProduct {
		id: ID!
		collectionId: ID!
		productId: ID!
		position: Int!
		addedAt: DateTime!
		collection: Collection
		product: Product
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type CollectionVariant {
		id: ID!
		collectionId: ID!
		variantId: ID!
		position: Int!
		addedAt: DateTime!
		collection: Collection
		variant: ProductVariant
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type CollectionChannel {
		id: ID!
		collectionId: ID!
		channelId: ID!
		status: PublicationStatus!
		publishedAt: DateTime
		collection: Collection
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type ProductPublication {
		id: ID!
		productId: ID!
		channelId: ID!
		status: PublicationStatus!
		publishedAt: DateTime
		unpublishedAt: DateTime
		sortOrder: Int!
		isFeatured: Boolean!
		product: Product
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type ProductVariantPublication {
		id: ID!
		variantId: ID!
		channelId: ID!
		status: PublicationStatus!
		publishedAt: DateTime
		unpublishedAt: DateTime
		sortOrder: Int!
		variant: ProductVariant
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type ProductRelation {
		id: ID!
		productId: ID!
		relatedProductId: ID!
		type: ProductRelationType!
		position: Int!
		product: Product
		relatedProduct: Product
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type ProductVariantMedia {
		id: ID!
		variantId: ID!
		imageAssetId: ID!
		position: Int!
		isPrimary: Boolean!
		variant: ProductVariant
		imageAsset: ImageAsset
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type TagProductVariant {
		id: ID!
		productVariantId: ID!
		tagId: ID!
		productVariant: ProductVariant
		tag: Tag
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type CollectionVariantConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [CollectionVariant!]!
		edges: [CollectionVariantEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One collection variant inside a page, with the cursor that addresses it."""
	type CollectionVariantEdge {
		cursor: String!
		node: CollectionVariant!
	}

	type CollectionChannelConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [CollectionChannel!]!
		edges: [CollectionChannelEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One collection channel inside a page, with the cursor that addresses it."""
	type CollectionChannelEdge {
		cursor: String!
		node: CollectionChannel!
	}

	type TagProductVariantConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [TagProductVariant!]!
		edges: [TagProductVariantEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One tag product variant inside a page, with the cursor that addresses it."""
	type TagProductVariantEdge {
		cursor: String!
		node: TagProductVariant!
	}

	type CollectionConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [Collection!]!
		edges: [CollectionEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One collection inside a page, with the cursor that addresses it."""
	type CollectionEdge {
		cursor: String!
		node: Collection!
	}

	type CollectionProductConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [CollectionProduct!]!
		edges: [CollectionProductEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One collection product inside a page, with the cursor that addresses it."""
	type CollectionProductEdge {
		cursor: String!
		node: CollectionProduct!
	}

	type ProductPublicationConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [ProductPublication!]!
		edges: [ProductPublicationEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One product publication inside a page, with the cursor that addresses it."""
	type ProductPublicationEdge {
		cursor: String!
		node: ProductPublication!
	}

	type ProductVariantPublicationConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [ProductVariantPublication!]!
		edges: [ProductVariantPublicationEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One product variant publication inside a page, with the cursor that addresses it."""
	type ProductVariantPublicationEdge {
		cursor: String!
		node: ProductVariantPublication!
	}

	type ProductRelationConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [ProductRelation!]!
		edges: [ProductRelationEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One product relation inside a page, with the cursor that addresses it."""
	type ProductRelationEdge {
		cursor: String!
		node: ProductRelation!
	}

	type ProductVariantMediaConnection {
		"""The rows of this page, in the order the service returned them."""
		nodes: [ProductVariantMedia!]!
		edges: [ProductVariantMediaEdge!]!
		"""How many rows the filters match, in total rather than in this page."""
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"""One product variant media inside a page, with the cursor that addresses it."""
	type ProductVariantMediaEdge {
		cursor: String!
		node: ProductVariantMedia!
	}

	input CollectionFilter {
		id: ID
		slug: String
		type: CollectionType
		status: PublicationStatus
		parentId: ID
		customerId: ID
		isFeatured: Boolean
	}

	input CollectionSort {
		field: String!
		direction: String
	}

	input CollectionProductFilter {
		collectionId: ID
		productId: ID
	}

	input CollectionVariantFilter {
		collectionId: ID
		variantId: ID
	}

	input CollectionChannelFilter {
		collectionId: ID
		channelId: ID
		status: PublicationStatus
	}

	input TagProductVariantFilter {
		productVariantId: ID
		tagId: ID
	}

	input ProductPublicationFilter {
		productId: ID
		channelId: ID
		status: PublicationStatus
	}

	input ProductVariantPublicationFilter {
		variantId: ID
		channelId: ID
		status: PublicationStatus
	}

	input ProductRelationFilter {
		productId: ID
		relatedProductId: ID
		type: ProductRelationType
	}

	input ProductVariantMediaFilter {
		variantId: ID
		imageAssetId: ID
	}

	input CreateCollectionInput {
		name: String!
		slug: String!
		description: String
		type: CollectionType
		status: PublicationStatus
		sortOrder: Int
		isFeatured: Boolean
		startsAt: DateTime
		endsAt: DateTime
		imageAssetId: ID
		parentId: ID
		customerId: ID
		metadata: JSON
	}

	input UpdateCollectionInput {
		name: String
		slug: String
		description: String
		type: CollectionType
		status: PublicationStatus
		sortOrder: Int
		isFeatured: Boolean
		startsAt: DateTime
		endsAt: DateTime
		imageAssetId: ID
		parentId: ID
		metadata: JSON
	}

	input CreateProductRelationInput {
		productId: ID!
		relatedProductId: ID!
		type: ProductRelationType
		position: Int
	}

	input UpdateProductRelationInput {
		type: ProductRelationType
		position: Int
	}

	input CollectionChannelInput {
		channelId: ID!
		status: PublicationStatus!
		publishedAt: DateTime
	}

	input ProductVariantPublicationInput {
		channelId: ID!
		status: PublicationStatus!
		publishedAt: DateTime
	}

	input ProductVariantMediaInput {
		imageAssetId: ID!
		position: Int
		isPrimary: Boolean
	}

	# The catalog's lists take the page in either of the protocol's two spellings and refuse a request that
	# states both: PageInput walks by cursor, limit/offset walks by position — where offset is the row to
	# start at, which is what the name says and what the connection's boundary reports back.
	extend type Query {
		collections(filter: CollectionFilter, page: PageInput, limit: Int, offset: Int): CollectionConnection!
		collection(id: ID!): Collection
		collectionBySlug(slug: String!): Collection
		collectionProducts(filter: CollectionProductFilter, page: PageInput, limit: Int, offset: Int): CollectionProductConnection!
		collectionVariants(filter: CollectionVariantFilter, page: PageInput, limit: Int, offset: Int): CollectionVariantConnection!
		collectionChannels(filter: CollectionChannelFilter, page: PageInput, limit: Int, offset: Int): CollectionChannelConnection!
		productVariantFacets(
			filter: TagProductVariantFilter
			page: PageInput
			limit: Int
			offset: Int
		): TagProductVariantConnection!
		productPublications(filter: ProductPublicationFilter, page: PageInput, limit: Int, offset: Int): ProductPublicationConnection!
		productPublication(id: ID!): ProductPublication
		productVariantPublications(
			filter: ProductVariantPublicationFilter
			page: PageInput
			limit: Int
			offset: Int
		): ProductVariantPublicationConnection!
		productRelations(filter: ProductRelationFilter, page: PageInput, limit: Int, offset: Int): ProductRelationConnection!
		productVariantMedia(filter: ProductVariantMediaFilter, page: PageInput, limit: Int, offset: Int): ProductVariantMediaConnection!
	}

	extend type Mutation {
		createCollection(input: CreateCollectionInput!): Collection!
		updateCollection(id: ID!, input: UpdateCollectionInput!): Collection!
		deleteCollection(id: ID!): Boolean!
		addCollectionProducts(collectionId: ID!, productIds: [ID!]!): [CollectionProduct!]!
		removeCollectionProducts(collectionId: ID!, productIds: [ID!]!): [CollectionProduct!]!
		addCollectionVariants(collectionId: ID!, variantIds: [ID!]!): [CollectionVariant!]!
		removeCollectionVariants(collectionId: ID!, variantIds: [ID!]!): [CollectionVariant!]!
		attachProductVariantFacets(variantId: ID!, tagIds: [ID!]!): [TagProductVariant!]!
		detachProductVariantFacets(variantId: ID!, tagIds: [ID!]!): [TagProductVariant!]!
		assignCollectionChannel(collectionId: ID!, input: CollectionChannelInput!): [CollectionChannel!]!
		unassignCollectionChannel(collectionId: ID!, channelId: ID!): [CollectionChannel!]!
		publishProduct(productId: ID!, channelIds: [ID!]!, publishedAt: DateTime): [ProductPublication!]!
		unpublishProduct(productId: ID!, channelIds: [ID!]!, unpublishedAt: DateTime): [ProductPublication!]!
		publishProductVariant(
			variantId: ID!
			input: [ProductVariantPublicationInput!]!
		): [ProductVariantPublication!]!
		unpublishProductVariant(variantId: ID!, channelIds: [ID!]!): [ProductVariantPublication!]!
		createProductRelation(input: CreateProductRelationInput!): ProductRelation!
		updateProductRelation(id: ID!, input: UpdateProductRelationInput!): ProductRelation!
		deleteProductRelation(id: ID!): Boolean!
		attachProductVariantMedia(variantId: ID!, input: [ProductVariantMediaInput!]!): [ProductVariantMedia!]!
		reorderProductVariantMedia(variantId: ID!, imageAssetIds: [ID!]!): [ProductVariantMedia!]!
		detachProductVariantMedia(variantId: ID!, imageAssetId: ID!): [ProductVariantMedia!]!
	}

	extend type Subscription {
		collectionChanged(id: ID): Collection!
		productPublished(productId: ID, channelId: ID): ProductPublication!
		productUnpublished(productId: ID, channelId: ID): ProductPublication!
	}
`;
