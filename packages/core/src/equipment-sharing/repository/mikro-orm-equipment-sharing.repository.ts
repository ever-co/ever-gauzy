import { EntityRepository } from '@mikro-orm/knex';
import { EquipmentSharing } from '../equipment-sharing.entity';

export class MikroOrmEquipmentSharingRepository extends EntityRepository<EquipmentSharing> { }
