import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Region } from '../region.entity';

/**
 * MikroORM repository of Region. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmRegionRepository extends MikroOrmBaseEntityRepository<Region> {}
