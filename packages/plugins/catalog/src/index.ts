/**
 * Public API Surface of @gauzy/plugin-catalog
 */
export * from './lib/catalog.plugin';
export * from './lib/catalog.module';
export * from './lib/catalog.types';
export * from './lib/catalog.permissions';
export * from './lib/catalog.features';
export * from './lib/events';
export * from './lib/graphql/schema-extensions';
export * from './lib/graphql/resolvers';
export * from './lib/database/migrations/1791000000100-CreateCatalogTables';

export * from './lib/collection/collection.entity';
export * from './lib/collection/collection.service';
export * from './lib/collection/collection.controller';
export * from './lib/collection/dto';
export * from './lib/collection/repository/type-orm-collection.repository';
export * from './lib/collection/repository/mikro-orm-collection.repository';

export * from './lib/collection-product/collection-product.entity';
export * from './lib/collection-product/collection-product.service';
export * from './lib/collection-product/collection-product.controller';
export * from './lib/collection-product/dto';
export * from './lib/collection-product/repository/type-orm-collection-product.repository';
export * from './lib/collection-product/repository/mikro-orm-collection-product.repository';

export * from './lib/collection-variant/collection-variant.entity';
export * from './lib/collection-variant/collection-variant.service';
export * from './lib/collection-variant/collection-variant.controller';
export * from './lib/collection-variant/dto';
export * from './lib/collection-variant/repository/type-orm-collection-variant.repository';
export * from './lib/collection-variant/repository/mikro-orm-collection-variant.repository';

export * from './lib/collection-channel/collection-channel.entity';
export * from './lib/collection-channel/collection-channel.service';
export * from './lib/collection-channel/collection-channel.controller';
export * from './lib/collection-channel/dto';
export * from './lib/collection-channel/repository/type-orm-collection-channel.repository';
export * from './lib/collection-channel/repository/mikro-orm-collection-channel.repository';

export * from './lib/product-channel/product-channel.entity';
export * from './lib/product-channel/product-channel.service';
export * from './lib/product-channel/product-channel.controller';
export * from './lib/product-channel/dto';
export * from './lib/product-channel/repository/type-orm-product-channel.repository';
export * from './lib/product-channel/repository/mikro-orm-product-channel.repository';

export * from './lib/product-variant-channel/product-variant-channel.entity';
export * from './lib/product-variant-channel/product-variant-channel.service';
export * from './lib/product-variant-channel/product-variant-channel.controller';
export * from './lib/product-variant-channel/dto';
export * from './lib/product-variant-channel/repository/type-orm-product-variant-channel.repository';
export * from './lib/product-variant-channel/repository/mikro-orm-product-variant-channel.repository';

export * from './lib/product-relation/product-relation.entity';
export * from './lib/product-relation/product-relation.service';
export * from './lib/product-relation/product-relation.controller';
export * from './lib/product-relation/dto';
export * from './lib/product-relation/repository/type-orm-product-relation.repository';
export * from './lib/product-relation/repository/mikro-orm-product-relation.repository';

export * from './lib/product-variant-media/product-variant-media.entity';
export * from './lib/product-variant-media/product-variant-media.service';
export * from './lib/product-variant-media/product-variant-media.controller';
export * from './lib/product-variant-media/dto';
export * from './lib/product-variant-media/repository/type-orm-product-variant-media.repository';
export * from './lib/product-variant-media/repository/mikro-orm-product-variant-media.repository';

export * from './lib/tag-product-variant/tag-product-variant.entity';
export * from './lib/tag-product-variant/tag-product-variant.service';
export * from './lib/tag-product-variant/tag-product-variant.controller';
export * from './lib/tag-product-variant/dto';
export * from './lib/tag-product-variant/repository/type-orm-tag-product-variant.repository';
export * from './lib/tag-product-variant/repository/mikro-orm-tag-product-variant.repository';
