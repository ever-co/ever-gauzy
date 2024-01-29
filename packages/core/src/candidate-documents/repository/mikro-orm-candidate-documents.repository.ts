import { EntityRepository } from '@mikro-orm/core';
import { CandidateDocument } from '../candidate-documents.entity';

export class MikroOrmCandidateDocumentsRepository extends EntityRepository<CandidateDocument> { }
