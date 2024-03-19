import { EntityRepository } from '@mikro-orm/knex';
import { CandidateInterview } from '../candidate-interview.entity';

export class MikroOrmCandidateInterviewRepository extends EntityRepository<CandidateInterview> { }
