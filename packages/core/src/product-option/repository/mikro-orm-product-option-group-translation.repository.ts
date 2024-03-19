import { EntityRepository } from '@mikro-orm/knex';
import { ProductOptionGroupTranslation } from '../product-option-group-translation.entity';

export class MikroOrmProductOptionGroupTranslationRepository extends EntityRepository<ProductOptionGroupTranslation> { }
