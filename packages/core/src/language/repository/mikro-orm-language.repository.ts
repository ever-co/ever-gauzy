import { EntityRepository } from '@mikro-orm/core';
import { Language } from '../language.entity';

export class MikroOrmLanguageRepository extends EntityRepository<Language> { }