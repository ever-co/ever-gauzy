import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Address } from '../address.entity';

/**
 * MikroORM repository of Address. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmAddressRepository extends MikroOrmBaseEntityRepository<Address> {}
