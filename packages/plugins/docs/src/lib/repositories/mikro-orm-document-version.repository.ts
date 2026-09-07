import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { DocumentVersion } from '../entities/document-version.entity';

export class MikroOrmDocumentVersionRepository extends MikroOrmBaseEntityRepository<DocumentVersion> {}
