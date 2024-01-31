import { EntityRepository } from '@mikro-orm/core';
import { CandidateExperience } from '../candidate-experience.entity';

export class MikroOrmCandidateExperienceRepository extends EntityRepository<CandidateExperience> { }