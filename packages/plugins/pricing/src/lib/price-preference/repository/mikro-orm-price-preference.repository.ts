import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PricePreference } from '../price-preference.entity';

export class MikroOrmPricePreferenceRepository extends MikroOrmBaseEntityRepository<PricePreference> {}
