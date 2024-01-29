import { Repository } from 'typeorm';
import { CandidateDocument } from '../candidate-documents.entity';

export class TypeOrmCandidateDocumentsRepository extends Repository<CandidateDocument> { }
