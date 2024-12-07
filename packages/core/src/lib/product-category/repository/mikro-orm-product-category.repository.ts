import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ProductCategory } from '../product-category.entity';

export class MikroOrmProductCategoryRepository extends MikroOrmBaseEntityRepository<ProductCategory> { }
