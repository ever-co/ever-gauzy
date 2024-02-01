import { EntityRepository } from '@mikro-orm/core';
import { ProductTranslation } from '../product-translation.entity';

export class MikroOrmProductTranslationRepository extends EntityRepository<ProductTranslation> { }
