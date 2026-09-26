import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { TagProductVariant } from '../tag-product-variant.entity';

/**
 * MikroORM repository for `TagProductVariant`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmTagProductVariantRepository extends MikroOrmBaseEntityRepository<TagProductVariant> {}

