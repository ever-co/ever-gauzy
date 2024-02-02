import { Repository } from 'typeorm';
import { CandidateSkill } from '../candidate-skill.entity';

export class TypeOrmCandidateSkillRepository extends Repository<CandidateSkill> { }