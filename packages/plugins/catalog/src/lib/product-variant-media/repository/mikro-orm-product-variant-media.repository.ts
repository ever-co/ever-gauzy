import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ProductVariantMedia } from '../product-variant-media.entity';

/**
 * MikroORM repository for `ProductVariantMedia`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmProductVariantMediaRepository extends MikroOrmBaseEntityRepository<ProductVariantMedia> {}

