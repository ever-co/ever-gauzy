import { EntityRepository } from '@mikro-orm/core';
import { Product } from '../product.entity';

export class MikroOrmProductRepository extends EntityRepository<Product> { }