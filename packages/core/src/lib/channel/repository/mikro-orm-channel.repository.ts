import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Channel } from '../channel.entity';

/**
 * MikroORM repository of Channel. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmChannelRepository extends MikroOrmBaseEntityRepository<Channel> {}
