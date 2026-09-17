import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CollectionVariant } from '../collection-variant.entity';

/**
 * MikroORM repository for `CollectionVariant`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmCollectionVariantRepository extends MikroOrmBaseEntityRepository<CollectionVariant> {}

