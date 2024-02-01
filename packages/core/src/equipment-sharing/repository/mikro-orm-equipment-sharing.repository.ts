import { EntityRepository } from '@mikro-orm/core';
import { EquipmentSharing } from '../equipment-sharing.entity';

export class MikroOrmEquipmentSharingRepository extends EntityRepository<EquipmentSharing> { }