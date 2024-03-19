import { EntityRepository } from '@mikro-orm/knex';
import { ProductCategoryTranslation } from '../product-category-translation.entity';

export class MikroOrmProductCategoryTranslationRepository extends EntityRepository<ProductCategoryTranslation> { }
