import { Repository } from 'typeorm';
import { CandidateInterviewers } from '../candidate-interviewers.entity';

export class TypeOrmCandidateInterviewersRepository extends Repository<CandidateInterviewers> { }