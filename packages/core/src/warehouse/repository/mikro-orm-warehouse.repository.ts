import { EntityRepository } from '@mikro-orm/core';
import { Warehouse } from '../warehouse.entity';

export class MikroOrmWarehouseRepository extends EntityRepository<Warehouse> { }