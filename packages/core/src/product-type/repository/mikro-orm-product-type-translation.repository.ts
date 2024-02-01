import { EntityRepository } from '@mikro-orm/core';
import { ProductTypeTranslation } from '../product-type-translation.entity';

export class MikroOrmProductTypeTranslationRepository extends EntityRepository<ProductTypeTranslation> { }
