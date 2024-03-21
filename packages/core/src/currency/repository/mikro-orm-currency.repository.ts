import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Currency } from '../currency.entity';

export class MikroOrmCurrencyRepository extends MikroOrmBaseEntityRepository<Currency> { }
