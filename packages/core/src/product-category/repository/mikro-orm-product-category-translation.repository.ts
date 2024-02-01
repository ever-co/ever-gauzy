import { EntityRepository } from '@mikro-orm/core';
import { ProductCategoryTranslation } from '../product-category-translation.entity';

export class MikroOrmProductCategoryTranslationRepository extends EntityRepository<ProductCategoryTranslation> { }
