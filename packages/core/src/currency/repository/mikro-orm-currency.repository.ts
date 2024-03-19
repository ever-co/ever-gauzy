import { EntityRepository } from '@mikro-orm/knex';
import { Currency } from '../currency.entity';

export class MikroOrmCurrencyRepository extends EntityRepository<Currency> { }
