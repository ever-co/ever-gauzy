import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentIndexState } from '../entities/document-index-state.entity';

@Injectable()
export class TypeOrmDocumentIndexStateRepository extends Repository<DocumentIndexState> {
	constructor(@InjectRepository(DocumentIndexState) readonly repository: Repository<DocumentIndexState>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
