import { EntityRepository } from '@mikro-orm/core';
import { Country } from '../country.entity';

export class MikroOrmCountryRepository extends EntityRepository<Country> { }