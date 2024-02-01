import { EntityRepository } from '@mikro-orm/core';
import { ProductVariant } from '../product-variant.entity';

export class MikroOrmProductVariantRepository extends EntityRepository<ProductVariant> { }