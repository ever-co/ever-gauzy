import { EntityRepository } from '@mikro-orm/knex';
import { ProductOption } from '../product-option.entity';

export class MikroOrmProductOptionRepository extends EntityRepository<ProductOption> { }
