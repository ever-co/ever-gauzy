import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { TaxCategory } from '../tax-category.entity';

export class MikroOrmTaxCategoryRepository extends MikroOrmBaseEntityRepository<TaxCategory> {}
