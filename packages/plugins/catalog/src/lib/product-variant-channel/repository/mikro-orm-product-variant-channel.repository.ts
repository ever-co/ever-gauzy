import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ProductVariantChannel } from '../product-variant-channel.entity';

/**
 * MikroORM repository for `ProductVariantChannel`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmProductVariantChannelRepository extends MikroOrmBaseEntityRepository<ProductVariantChannel> {}

