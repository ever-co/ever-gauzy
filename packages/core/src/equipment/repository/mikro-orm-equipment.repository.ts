import { EntityRepository } from '@mikro-orm/core';
import { Equipment } from '../equipment.entity';

export class MikroOrmEquipmentRepository extends EntityRepository<Equipment> { }