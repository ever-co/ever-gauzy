import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentLink } from '../entities/document-link.entity';

@Injectable()
export class TypeOrmDocumentLinkRepository extends Repository<DocumentLink> {
	constructor(@InjectRepository(DocumentLink) readonly repository: Repository<DocumentLink>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
