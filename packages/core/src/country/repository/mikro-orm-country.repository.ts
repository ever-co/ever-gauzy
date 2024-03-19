import { EntityRepository } from '@mikro-orm/knex';
import { Country } from '../country.entity';

export class MikroOrmCountryRepository extends EntityRepository<Country> { }
