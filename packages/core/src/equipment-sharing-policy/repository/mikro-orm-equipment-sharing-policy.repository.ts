import { EntityRepository } from '@mikro-orm/core';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy.entity';

export class MikroOrmEquipmentSharingPolicyRepository extends EntityRepository<EquipmentSharingPolicy> { }