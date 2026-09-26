import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ChannelRegion } from '../channel-region.entity';

/**
 * MikroORM repository of ChannelRegion. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmChannelRegionRepository extends MikroOrmBaseEntityRepository<ChannelRegion> {}
