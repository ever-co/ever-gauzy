import { EntityRepository } from '@mikro-orm/knex';
import { WarehouseProductVariant } from '../warehouse-product-variant.entity';

export class MikroOrmWarehouseProductVariantRepository extends EntityRepository<WarehouseProductVariant> { }
