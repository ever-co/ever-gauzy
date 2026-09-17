import { CollectionResolver } from './collection.resolver';
import { ProductPublicationResolver } from './product-publication.resolver';
import { ProductRelationResolver } from './product-relation.resolver';
import { ProductVariantMediaResolver } from './product-variant-media.resolver';

/**
 * The resolver classes this plugin contributes.
 *
 * The platform registers them only when the plugin is configured, so disabling the plugin removes its
 * schema contribution and its resolvers together.
 */
export const resolvers = [
	CollectionResolver,
	ProductPublicationResolver,
	ProductRelationResolver,
	ProductVariantMediaResolver
];

export { CollectionResolver, ProductPublicationResolver, ProductRelationResolver, ProductVariantMediaResolver };
