import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentVersion } from '../entities/document-version.entity';

@Injectable()
export class TypeOrmDocumentVersionRepository extends Repository<DocumentVersion> {
	constructor(@InjectRepository(DocumentVersion) readonly repository: Repository<DocumentVersion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
