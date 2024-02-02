import { Repository } from 'typeorm';
import { Country } from '../country.entity';

export class TypeOrmCountryRepository extends Repository<Country> { }