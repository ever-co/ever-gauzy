import { EntityRepository } from '@mikro-orm/knex';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy.entity';

export class MikroOrmEquipmentSharingPolicyRepository extends EntityRepository<EquipmentSharingPolicy> { }
