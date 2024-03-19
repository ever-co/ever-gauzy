import { EntityRepository } from '@mikro-orm/knex';
import { ProductTypeTranslation } from '../product-type-translation.entity';

export class MikroOrmProductTypeTranslationRepository extends EntityRepository<ProductTypeTranslation> { }
