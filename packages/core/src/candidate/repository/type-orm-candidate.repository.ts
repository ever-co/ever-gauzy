import { Repository } from 'typeorm';
import { Candidate } from '../candidate.entity';

export class TypeOrmCandidateRepository extends Repository<Candidate> { }