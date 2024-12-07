import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ProductType } from '../product-type.entity';

export class MikroOrmProductTypeRepository extends MikroOrmBaseEntityRepository<ProductType> { }
