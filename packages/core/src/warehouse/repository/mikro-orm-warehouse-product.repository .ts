import { EntityRepository } from '@mikro-orm/core';
import { WarehouseProduct } from '../warehouse-product.entity';

export class MikroOrmWarehouseProductRepository extends EntityRepository<WarehouseProduct> { }
