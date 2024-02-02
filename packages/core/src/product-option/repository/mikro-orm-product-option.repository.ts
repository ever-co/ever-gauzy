import { EntityRepository } from '@mikro-orm/core';
import { ProductOption } from '../product-option.entity';

export class MikroOrmProductOptionRepository extends EntityRepository<ProductOption> { }