import { EntityRepository } from '@mikro-orm/knex';
import { WarehouseProduct } from '../warehouse-product.entity';

export class MikroOrmWarehouseProductRepository extends EntityRepository<WarehouseProduct> { }
