import { Repository } from 'typeorm';
import { CandidateTechnologies } from '../candidate-technologies.entity';

export class TypeOrmCandidateTechnologiesRepository extends Repository<CandidateTechnologies> { }