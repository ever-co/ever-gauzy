import { EntityRepository } from '@mikro-orm/core';
import { ProductType } from '../product-type.entity';

export class MikroOrmProductTypeRepository extends EntityRepository<ProductType> { }