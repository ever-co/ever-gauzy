import { Repository } from 'typeorm';
import { CandidateInterview } from '../candidate-interview.entity';

export class TypeOrmCandidateInterviewRepository extends Repository<CandidateInterview> { }