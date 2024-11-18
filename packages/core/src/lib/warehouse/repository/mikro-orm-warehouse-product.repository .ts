import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { WarehouseProduct } from '../warehouse-product.entity';

export class MikroOrmWarehouseProductRepository extends MikroOrmBaseEntityRepository<WarehouseProduct> { }
