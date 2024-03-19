import { EntityRepository } from '@mikro-orm/knex';
import { ProductTranslation } from '../product-translation.entity';

export class MikroOrmProductTranslationRepository extends EntityRepository<ProductTranslation> { }
