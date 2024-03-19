import { EntityRepository } from '@mikro-orm/knex';
import { ProductOptionGroup } from '../product-option-group.entity';

export class MikroOrmProductOptionGroupRepository extends EntityRepository<ProductOptionGroup> { }
