import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CollectionChannel } from '../collection-channel.entity';

/**
 * MikroORM repository for `CollectionChannel`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmCollectionChannelRepository extends MikroOrmBaseEntityRepository<CollectionChannel> {}

