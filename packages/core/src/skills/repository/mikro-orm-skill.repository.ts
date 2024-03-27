import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Skill } from '../skill.entity';

export class MikroOrmSkillRepository extends MikroOrmBaseEntityRepository<Skill> { }
