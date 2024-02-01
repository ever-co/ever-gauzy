import { EntityRepository } from '@mikro-orm/core';
import { CandidateEducation } from '../candidate-education.entity';

export class MikroOrmCandidateEducationRepository extends EntityRepository<CandidateEducation> { }