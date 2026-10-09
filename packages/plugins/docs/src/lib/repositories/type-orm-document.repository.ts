import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';

@Injectable()
export class TypeOrmDocumentRepository extends Repository<Document> {
	constructor(@InjectRepository(Document) readonly repository: Repository<Document>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
