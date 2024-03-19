import { EntityRepository } from '@mikro-orm/knex';
import { CandidateExperience } from '../candidate-experience.entity';

export class MikroOrmCandidateExperienceRepository extends EntityRepository<CandidateExperience> { }
