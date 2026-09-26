import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ContactBuyer } from '../contact-buyer.entity';

/**
 * MikroORM repository of ContactBuyer. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmContactBuyerRepository extends MikroOrmBaseEntityRepository<ContactBuyer> {}
