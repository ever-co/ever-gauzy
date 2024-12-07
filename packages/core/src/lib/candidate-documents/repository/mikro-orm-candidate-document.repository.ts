import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { CandidateDocument } from '../candidate-documents.entity';

export class MikroOrmCandidateDocumentRepository extends MikroOrmBaseEntityRepository<CandidateDocument> { }
