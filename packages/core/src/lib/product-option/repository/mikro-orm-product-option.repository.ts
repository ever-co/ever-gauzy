import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ProductOption } from '../product-option.entity';

export class MikroOrmProductOptionRepository extends MikroOrmBaseEntityRepository<ProductOption> { }
