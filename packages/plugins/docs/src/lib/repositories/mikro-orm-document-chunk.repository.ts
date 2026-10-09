import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { DocumentChunk } from '../entities/document-chunk.entity';

export class MikroOrmDocumentChunkRepository extends MikroOrmBaseEntityRepository<DocumentChunk> {}
