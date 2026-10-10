import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ExchangeRate } from '../exchange-rate.entity';

export class MikroOrmExchangeRateRepository extends MikroOrmBaseEntityRepository<ExchangeRate> {}
