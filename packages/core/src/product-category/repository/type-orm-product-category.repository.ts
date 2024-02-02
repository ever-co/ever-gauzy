import { Repository } from 'typeorm';
import { ProductCategory } from '../product-category.entity';

export class TypeOrmProductCategoryRepository extends Repository<ProductCategory> { }