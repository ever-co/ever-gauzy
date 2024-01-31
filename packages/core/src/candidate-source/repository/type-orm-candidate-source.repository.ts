import { Repository } from 'typeorm';
import { CandidateSource } from '../candidate-source.entity';

export class TypeOrmCandidateSourceRepository extends Repository<CandidateSource> { }