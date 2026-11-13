import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentImport } from '../entities/document-import.entity';

@Injectable()
export class TypeOrmDocumentImportRepository extends Repository<DocumentImport> {
	constructor(@InjectRepository(DocumentImport) readonly repository: Repository<DocumentImport>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
