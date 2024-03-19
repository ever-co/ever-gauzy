import { EntityRepository } from '@mikro-orm/knex';
import { CandidateSkill } from '../candidate-skill.entity';

export class MikroOrmCandidateSkillRepository extends EntityRepository<CandidateSkill> { }
