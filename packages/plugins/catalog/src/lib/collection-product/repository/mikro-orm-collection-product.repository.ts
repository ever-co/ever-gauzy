import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CollectionProduct } from '../collection-product.entity';

/**
 * MikroORM repository for `CollectionProduct`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmCollectionProductRepository extends MikroOrmBaseEntityRepository<CollectionProduct> {}

