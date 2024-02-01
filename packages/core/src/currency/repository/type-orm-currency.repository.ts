import { Repository } from 'typeorm';
import { Currency } from '../currency.entity';

export class TypeOrmCurrencyRepository extends Repository<Currency> { }