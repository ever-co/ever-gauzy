import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ChannelDomain } from '../channel-domain.entity';

/**
 * MikroORM repository of ChannelDomain. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmChannelDomainRepository extends MikroOrmBaseEntityRepository<ChannelDomain> {}
