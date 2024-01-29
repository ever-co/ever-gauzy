import { Repository } from 'typeorm';
import { ProductType } from '../product-type.entity';

export class TypeOrmProductTypeRepository extends Repository<ProductType> { }