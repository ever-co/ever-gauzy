import { Repository } from 'typeorm';
import { WarehouseProduct } from '../warehouse-product.entity';

export class TypeOrmWarehouseProductRepository extends Repository<WarehouseProduct> { }
