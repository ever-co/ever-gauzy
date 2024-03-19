import { EntityRepository } from '@mikro-orm/knex';
import { Product } from '../product.entity';

export class MikroOrmProductRepository extends EntityRepository<Product> { }
