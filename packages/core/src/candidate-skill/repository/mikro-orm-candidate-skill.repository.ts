import { EntityRepository } from '@mikro-orm/core';
import { CandidateSkill } from '../candidate-skill.entity';

export class MikroOrmCandidateSkillRepository extends EntityRepository<CandidateSkill> { }