import { Repository } from 'typeorm';
import { Skill } from '../skill.entity';

export class TypeOrmSkillRepository extends Repository<Skill> { }
