import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ContactGroupMember } from '../contact-group-member.entity';

/**
 * MikroORM repository of ContactGroupMember. The base class supplies the entity-manager-backed
 * operations the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmContactGroupMemberRepository extends MikroOrmBaseEntityRepository<ContactGroupMember> {}
