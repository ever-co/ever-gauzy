import { Repository } from 'typeorm';
import { CandidateEducation } from '../candidate-education.entity';

export class TypeOrmCandidateEducationRepository extends Repository<CandidateEducation> { }