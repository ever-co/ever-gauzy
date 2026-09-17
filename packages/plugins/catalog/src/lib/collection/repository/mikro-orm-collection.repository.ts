import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Collection } from '../collection.entity';

/**
 * MikroORM repository for `Collection`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmCollectionRepository extends MikroOrmBaseEntityRepository<Collection> {}

