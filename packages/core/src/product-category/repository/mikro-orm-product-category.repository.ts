import { EntityRepository } from '@mikro-orm/knex';
import { ProductCategory } from '../product-category.entity';

export class MikroOrmProductCategoryRepository extends EntityRepository<ProductCategory> { }
