import { EntityRepository } from '@mikro-orm/core';
import { ProductCategory } from '../product-category.entity';

export class MikroOrmProductCategoryRepository extends EntityRepository<ProductCategory> { }