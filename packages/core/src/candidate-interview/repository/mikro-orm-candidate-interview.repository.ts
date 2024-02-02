import { EntityRepository } from '@mikro-orm/core';
import { CandidateInterview } from '../candidate-interview.entity';

export class MikroOrmCandidateInterviewRepository extends EntityRepository<CandidateInterview> { }