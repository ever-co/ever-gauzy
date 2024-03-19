import { EntityRepository } from '@mikro-orm/knex';
import { CandidateEducation } from '../candidate-education.entity';

export class MikroOrmCandidateEducationRepository extends EntityRepository<CandidateEducation> { }
