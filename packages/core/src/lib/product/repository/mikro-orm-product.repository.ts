import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Product } from '../product.entity';

export class MikroOrmProductRepository extends MikroOrmBaseEntityRepository<Product> { }
