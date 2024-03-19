import { EntityRepository } from '@mikro-orm/knex';
import { ProductVariantPrice } from '../product-variant-price.entity';

export class MikroOrmProductVariantPriceRepository extends EntityRepository<ProductVariantPrice> { }
