import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ProductVariant } from '../product-variant.entity';

export class MikroOrmProductVariantRepository extends MikroOrmBaseEntityRepository<ProductVariant> { }
