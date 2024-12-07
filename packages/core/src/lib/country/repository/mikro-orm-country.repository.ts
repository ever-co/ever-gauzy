import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Country } from '../country.entity';

export class MikroOrmCountryRepository extends MikroOrmBaseEntityRepository<Country> { }
