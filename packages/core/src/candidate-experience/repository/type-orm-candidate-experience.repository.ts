import { Repository } from 'typeorm';
import { CandidateExperience } from '../candidate-experience.entity';

export class TypeOrmCandidateExperienceRepository extends Repository<CandidateExperience> { }