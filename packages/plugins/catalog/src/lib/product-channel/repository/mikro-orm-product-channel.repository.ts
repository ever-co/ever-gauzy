import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ProductChannel } from '../product-channel.entity';

/**
 * MikroORM repository for `ProductChannel`.
 *
 * Declared on the entity through `@MultiORMEntity`'s `mikroOrmRepository` option, so the repository
 * the entity is discovered with is this one rather than the ORM's default.
 */
export class MikroOrmProductChannelRepository extends MikroOrmBaseEntityRepository<ProductChannel> {}

