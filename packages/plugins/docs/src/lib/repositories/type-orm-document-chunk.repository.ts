import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity';

@Injectable()
export class TypeOrmDocumentChunkRepository extends Repository<DocumentChunk> {
	constructor(@InjectRepository(DocumentChunk) readonly repository: Repository<DocumentChunk>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
