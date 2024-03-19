import { EntityRepository } from '@mikro-orm/knex';
import { CandidateInterviewers } from '../candidate-interviewers.entity';

export class MikroOrmCandidateInterviewersRepository extends EntityRepository<CandidateInterviewers> { }
