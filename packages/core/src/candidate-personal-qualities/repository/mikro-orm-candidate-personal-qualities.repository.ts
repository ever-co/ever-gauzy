import { EntityRepository } from '@mikro-orm/knex';
import { CandidatePersonalQualities } from '../candidate-personal-qualities.entity';

export class MikroOrmCandidatePersonalQualitiesRepository extends EntityRepository<CandidatePersonalQualities> { }
