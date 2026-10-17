import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { RegionCountry } from '../region-country.entity';

/**
 * MikroORM repository of RegionCountry. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmRegionCountryRepository extends MikroOrmBaseEntityRepository<RegionCountry> {}
