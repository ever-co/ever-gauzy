import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ProductRelation } from '../product-relation.entity';

/**
 * MikroORM repository for `ProductRelation`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmProductRelationRepository extends MikroOrmBaseEntityRepository<ProductRelation> {}

