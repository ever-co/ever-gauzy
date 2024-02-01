import { EntityRepository } from '@mikro-orm/core';
import { Currency } from '../currency.entity';

export class MikroOrmCurrencyRepository extends EntityRepository<Currency> { }