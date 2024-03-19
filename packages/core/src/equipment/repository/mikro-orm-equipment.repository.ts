import { EntityRepository } from '@mikro-orm/knex';
import { Equipment } from '../equipment.entity';

export class MikroOrmEquipmentRepository extends EntityRepository<Equipment> { }
