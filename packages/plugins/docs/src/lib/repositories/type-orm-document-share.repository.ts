import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentShare } from '../entities/document-share.entity';

@Injectable()
export class TypeOrmDocumentShareRepository extends Repository<DocumentShare> {
	constructor(@InjectRepository(DocumentShare) readonly repository: Repository<DocumentShare>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
