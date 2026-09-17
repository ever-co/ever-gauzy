import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { TaxRatePart } from '../tax-rate-part.entity';

export class MikroOrmTaxRatePartRepository extends MikroOrmBaseEntityRepository<TaxRatePart> {}
