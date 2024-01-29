import { Repository } from 'typeorm';
import { Skill } from '../skill.entity';

export class TypeOrmSkillsRepository extends Repository<Skill> { }
