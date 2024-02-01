import { Repository } from 'typeorm';
import { CandidateDocument } from '../candidate-documents.entity';

export class TypeOrmCandidateDocumentRepository extends Repository<CandidateDocument> { }
