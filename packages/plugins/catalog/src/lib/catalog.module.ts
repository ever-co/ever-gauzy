import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '@gauzy/core';
import { Collection } from './collection/collection.entity';
import { CollectionController } from './collection/collection.controller';
import { CollectionService } from './collection/collection.service';
import { CollectionChannel } from './collection-channel/collection-channel.entity';
import { CollectionChannelController } from './collection-channel/collection-channel.controller';
import { CollectionChannelService } from './collection-channel/collection-channel.service';
import { CollectionProduct } from './collection-product/collection-product.entity';
import { CollectionProductController } from './collection-product/collection-product.controller';
import { CollectionProductService } from './collection-product/collection-product.service';
import { CollectionVariant } from './collection-variant/collection-variant.entity';
import { CollectionVariantController } from './collection-variant/collection-variant.controller';
import { CollectionVariantService } from './collection-variant/collection-variant.service';
import { resolvers } from './graphql/resolvers';
import { ProductChannel } from './product-channel/product-channel.entity';
import { ProductChannelController } from './product-channel/product-channel.controller';
import { ProductChannelService } from './product-channel/product-channel.service';
import { ProductRelation } from './product-relation/product-relation.entity';
import { ProductRelationController } from './product-relation/product-relation.controller';
import { ProductRelationService } from './product-relation/product-relation.service';
import { ProductVariantChannel } from './product-variant-channel/product-variant-channel.entity';
import { ProductVariantChannelController } from './product-variant-channel/product-variant-channel.controller';
import { ProductVariantChannelService } from './product-variant-channel/product-variant-channel.service';
import { ProductVariantMedia } from './product-variant-media/product-variant-media.entity';
import { ProductVariantMediaController } from './product-variant-media/product-variant-media.controller';
import { ProductVariantMediaService } from './product-variant-media/product-variant-media.service';
import { TagProductVariant } from './tag-product-variant/tag-product-variant.entity';
import { TagProductVariantController } from './tag-product-variant/tag-product-variant.controller';
import { TagProductVariantService } from './tag-product-variant/tag-product-variant.service';
import { MikroOrmCollectionRepository } from './collection/repository/mikro-orm-collection.repository';
import { TypeOrmCollectionRepository } from './collection/repository/type-orm-collection.repository';
import { MikroOrmCollectionChannelRepository } from './collection-channel/repository/mikro-orm-collection-channel.repository';
import { TypeOrmCollectionChannelRepository } from './collection-channel/repository/type-orm-collection-channel.repository';
import { MikroOrmCollectionProductRepository } from './collection-product/repository/mikro-orm-collection-product.repository';
import { TypeOrmCollectionProductRepository } from './collection-product/repository/type-orm-collection-product.repository';
import { MikroOrmCollectionVariantRepository } from './collection-variant/repository/mikro-orm-collection-variant.repository';
import { TypeOrmCollectionVariantRepository } from './collection-variant/repository/type-orm-collection-variant.repository';
import { MikroOrmProductChannelRepository } from './product-channel/repository/mikro-orm-product-channel.repository';
import { TypeOrmProductChannelRepository } from './product-channel/repository/type-orm-product-channel.repository';
import { MikroOrmProductRelationRepository } from './product-relation/repository/mikro-orm-product-relation.repository';
import { TypeOrmProductRelationRepository } from './product-relation/repository/type-orm-product-relation.repository';
import { MikroOrmProductVariantChannelRepository } from './product-variant-channel/repository/mikro-orm-product-variant-channel.repository';
import { TypeOrmProductVariantChannelRepository } from './product-variant-channel/repository/type-orm-product-variant-channel.repository';
import { MikroOrmProductVariantMediaRepository } from './product-variant-media/repository/mikro-orm-product-variant-media.repository';
import { TypeOrmProductVariantMediaRepository } from './product-variant-media/repository/type-orm-product-variant-media.repository';
import { MikroOrmTagProductVariantRepository } from './tag-product-variant/repository/mikro-orm-tag-product-variant.repository';
import { TypeOrmTagProductVariantRepository } from './tag-product-variant/repository/type-orm-tag-product-variant.repository';

/**
 * The catalog plugin's own module.
 *
 * Both ORM registrations are declared for every entity, so the same module boots under either ORM.
 * `EventBusModule` is imported because the services publish their domain events through the platform
 * bus rather than through a private one, which is what lets a subscriber outside this plugin hear them.
 */
@Module({
	controllers: [
		CollectionController,
		CollectionProductController,
		CollectionVariantController,
		CollectionChannelController,
		ProductChannelController,
		ProductVariantChannelController,
		ProductRelationController,
		ProductVariantMediaController,
		TagProductVariantController
	],
	imports: [
		TypeOrmModule.forFeature([
			Collection,
			CollectionProduct,
			CollectionVariant,
			CollectionChannel,
			ProductChannel,
			ProductVariantChannel,
			ProductRelation,
			ProductVariantMedia,
			TagProductVariant
		]),
		MikroOrmModule.forFeature([
			Collection,
			CollectionProduct,
			CollectionVariant,
			CollectionChannel,
			ProductChannel,
			ProductVariantChannel,
			ProductRelation,
			ProductVariantMedia,
			TagProductVariant
		]),
		EventBusModule
	],
	providers: [
		CollectionService,
		CollectionProductService,
		CollectionVariantService,
		CollectionChannelService,
		ProductChannelService,
		ProductVariantChannelService,
		ProductRelationService,
		ProductVariantMediaService,
		TagProductVariantService,
		TypeOrmCollectionRepository,
		MikroOrmCollectionRepository,
		TypeOrmCollectionProductRepository,
		MikroOrmCollectionProductRepository,
		TypeOrmCollectionVariantRepository,
		MikroOrmCollectionVariantRepository,
		TypeOrmCollectionChannelRepository,
		MikroOrmCollectionChannelRepository,
		TypeOrmProductChannelRepository,
		MikroOrmProductChannelRepository,
		TypeOrmProductVariantChannelRepository,
		MikroOrmProductVariantChannelRepository,
		TypeOrmProductRelationRepository,
		MikroOrmProductRelationRepository,
		TypeOrmProductVariantMediaRepository,
		MikroOrmProductVariantMediaRepository,
		TypeOrmTagProductVariantRepository,
		MikroOrmTagProductVariantRepository,
		...resolvers
	],
	exports: [
		CollectionService,
		CollectionProductService,
		CollectionVariantService,
		CollectionChannelService,
		ProductChannelService,
		ProductVariantChannelService,
		ProductRelationService,
		ProductVariantMediaService,
		TagProductVariantService
	]
})
export class CatalogModule {}
