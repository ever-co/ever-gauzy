import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentCategory } from '../entities/document-category.entity';

@Injectable()
export class TypeOrmDocumentCategoryRepository extends Repository<DocumentCategory> {
	constructor(@InjectRepository(DocumentCategory) readonly repository: Repository<DocumentCategory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
