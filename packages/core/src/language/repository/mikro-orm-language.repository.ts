import { EntityRepository } from '@mikro-orm/knex';
import { Language } from '../language.entity';

export class MikroOrmLanguageRepository extends EntityRepository<Language> { }
