import { EntityRepository } from '@mikro-orm/core';
import { CandidatePersonalQualities } from '../candidate-personal-qualities.entity';

export class MikroOrmCandidatePersonalQualitiesRepository extends EntityRepository<CandidatePersonalQualities> { }