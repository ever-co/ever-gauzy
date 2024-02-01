import { EntityRepository } from '@mikro-orm/core';
import { CandidateInterviewers } from '../candidate-interviewers.entity';

export class MikroOrmCandidateInterviewersRepository extends EntityRepository<CandidateInterviewers> { }