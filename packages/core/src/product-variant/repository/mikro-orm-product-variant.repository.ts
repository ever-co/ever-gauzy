import { EntityRepository } from '@mikro-orm/knex';
import { ProductVariant } from '../product-variant.entity';

export class MikroOrmProductVariantRepository extends EntityRepository<ProductVariant> { }
