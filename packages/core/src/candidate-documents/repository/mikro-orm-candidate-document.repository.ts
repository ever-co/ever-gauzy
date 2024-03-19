import { EntityRepository } from '@mikro-orm/knex';
import { CandidateDocument } from '../candidate-documents.entity';

export class MikroOrmCandidateDocumentRepository extends EntityRepository<CandidateDocument> { }
