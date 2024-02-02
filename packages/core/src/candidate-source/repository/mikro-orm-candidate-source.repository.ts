import { EntityRepository } from '@mikro-orm/core';
import { CandidateSource } from '../candidate-source.entity';

export class MikroOrmCandidateSourceRepository extends EntityRepository<CandidateSource> { }