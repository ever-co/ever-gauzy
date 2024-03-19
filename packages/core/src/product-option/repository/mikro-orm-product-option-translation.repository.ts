import { EntityRepository } from '@mikro-orm/knex';
import { ProductOptionTranslation } from '../product-option-translation.entity';

export class MikroOrmProductOptionTranslationRepository extends EntityRepository<ProductOptionTranslation> { }
