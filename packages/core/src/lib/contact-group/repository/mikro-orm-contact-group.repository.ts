import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ContactGroup } from '../contact-group.entity';

/**
 * MikroORM repository of ContactGroup. The base class supplies the entity-manager-backed operations the
 * service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmContactGroupRepository extends MikroOrmBaseEntityRepository<ContactGroup> {}
