import { EntityRepository } from '@mikro-orm/knex';
import { Skill } from '../skill.entity';

export class MikroOrmSkillRepository extends EntityRepository<Skill> { }
