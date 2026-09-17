import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { TaxRegime } from '../tax-regime.entity';

export class MikroOrmTaxRegimeRepository extends MikroOrmBaseEntityRepository<TaxRegime> {}
