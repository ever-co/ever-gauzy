import { EntityRepository } from '@mikro-orm/core';
import { WarehouseProductVariant } from '../warehouse-product-variant.entity';

export class MikroOrmWarehouseProductVariantRepository extends EntityRepository<WarehouseProductVariant> { }
