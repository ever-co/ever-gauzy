import { EntityRepository } from '@mikro-orm/knex';
import { Warehouse } from '../warehouse.entity';

export class MikroOrmWarehouseRepository extends EntityRepository<Warehouse> { }
