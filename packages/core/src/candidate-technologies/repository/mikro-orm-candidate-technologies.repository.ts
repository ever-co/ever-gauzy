import { EntityRepository } from '@mikro-orm/core';
import { CandidateTechnologies } from '../candidate-technologies.entity';

export class MikroOrmCandidateTechnologiesRepository extends EntityRepository<CandidateTechnologies> { }