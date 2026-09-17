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

	type CollectionConnection {
		items: [Collection!]!
		total: Int!
		pageInfo: PageInfo
	}

	type CollectionProductConnection {
		items: [CollectionProduct!]!
		total: Int!
		pageInfo: PageInfo
	}

	type ProductPublicationConnection {
		items: [ProductPublication!]!
		total: Int!
		pageInfo: PageInfo
	}

	type ProductVariantPublicationConnection {
		items: [ProductVariantPublication!]!
		total: Int!
		pageInfo: PageInfo
	}

	type ProductRelationConnection {
		items: [ProductRelation!]!
		total: Int!
		pageInfo: PageInfo
	}

	type ProductVariantMediaConnection {
		items: [ProductVariantMedia!]!
		total: Int!
		pageInfo: PageInfo
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

	extend type Query {
		collections(filter: CollectionFilter, page: PageInput, limit: Int, offset: Int): CollectionConnection!
		collection(id: ID!): Collection
		collectionBySlug(slug: String!): Collection
		collectionProducts(filter: CollectionProductFilter, limit: Int, offset: Int): CollectionProductConnection!
		productPublications(filter: ProductPublicationFilter, limit: Int, offset: Int): ProductPublicationConnection!
		productPublication(id: ID!): ProductPublication
		productVariantPublications(
			filter: ProductVariantPublicationFilter
			limit: Int
			offset: Int
		): ProductVariantPublicationConnection!
		productRelations(filter: ProductRelationFilter, limit: Int, offset: Int): ProductRelationConnection!
		productVariantMedia(filter: ProductVariantMediaFilter, limit: Int, offset: Int): ProductVariantMediaConnection!
	}

	extend type Mutation {
		createCollection(input: CreateCollectionInput!): Collection!
		updateCollection(id: ID!, input: UpdateCollectionInput!): Collection!
		deleteCollection(id: ID!): Boolean!
		addCollectionProducts(collectionId: ID!, productIds: [ID!]!): [CollectionProduct!]!
		removeCollectionProducts(collectionId: ID!, productIds: [ID!]!): [CollectionProduct!]!
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
