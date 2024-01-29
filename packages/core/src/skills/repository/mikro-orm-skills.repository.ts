import { EntityRepository } from '@mikro-orm/core';
import { Skill } from '../skill.entity';

export class MikroOrmSkillsRepository extends EntityRepository<Skill> { }
