import { EntityRepository } from '@mikro-orm/core';
import { ProductVariantPrice } from '../product-variant-price.entity';

export class MikroOrmProductVariantPriceRepository extends EntityRepository<ProductVariantPrice> { }