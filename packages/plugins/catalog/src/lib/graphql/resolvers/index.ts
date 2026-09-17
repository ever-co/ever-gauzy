import { CollectionResolver } from './collection.resolver';
import { CollectionProductResolver } from './collection-product.resolver';
import { CollectionVariantResolver } from './collection-variant.resolver';
import { CollectionChannelResolver } from './collection-channel.resolver';
import { ProductPublicationResolver } from './product-publication.resolver';
import { ProductRelationResolver } from './product-relation.resolver';
import { ProductVariantMediaResolver } from './product-variant-media.resolver';
import { TagProductVariantResolver } from './tag-product-variant.resolver';

/**
 * The resolver classes this plugin contributes.
 *
 * There is one per aggregate, mirroring the controllers one for one: a concept reachable over REST is
 * reachable over GraphQL, and both doors call the same service. The platform registers these only when
 * the plugin is configured, so disabling the plugin removes its schema contribution and its resolvers
 * together.
 */
export const resolvers = [
	CollectionResolver,
	CollectionProductResolver,
	CollectionVariantResolver,
	CollectionChannelResolver,
	ProductPublicationResolver,
	ProductRelationResolver,
	ProductVariantMediaResolver,
	TagProductVariantResolver
];

export {
	CollectionResolver,
	CollectionProductResolver,
	CollectionVariantResolver,
	CollectionChannelResolver,
	ProductPublicationResolver,
	ProductRelationResolver,
	ProductVariantMediaResolver,
	TagProductVariantResolver
};
