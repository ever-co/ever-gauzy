import { EntityRepository } from '@mikro-orm/knex';
import { ProductType } from '../product-type.entity';

export class MikroOrmProductTypeRepository extends EntityRepository<ProductType> { }
