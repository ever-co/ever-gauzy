import { EntityRepository } from '@mikro-orm/core';
import { Candidate } from '../candidate.entity';

export class MikroOrmCandidateRepository extends EntityRepository<Candidate> { }