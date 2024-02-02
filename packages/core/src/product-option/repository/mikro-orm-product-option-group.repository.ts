import { EntityRepository } from '@mikro-orm/core';
import { ProductOptionGroup } from '../product-option-group.entity';

export class MikroOrmProductOptionGroupRepository extends EntityRepository<ProductOptionGroup> { }
