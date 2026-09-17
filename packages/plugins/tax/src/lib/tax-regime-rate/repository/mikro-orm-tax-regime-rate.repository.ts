import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { TaxRegimeRate } from '../tax-regime-rate.entity';

export class MikroOrmTaxRegimeRateRepository extends MikroOrmBaseEntityRepository<TaxRegimeRate> {}
