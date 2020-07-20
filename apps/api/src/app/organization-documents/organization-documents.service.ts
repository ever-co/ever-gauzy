import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationDocuments } from './organization-documents.entity';

@Injectable()
export class OrganizationDocumentsService extends CrudService<
	OrganizationDocuments
> {
	constructor(
		@InjectRepository(OrganizationDocuments)
		private readonly candidateDocumentRepository: Repository<
			OrganizationDocuments
		>
	) {
		super(candidateDocumentRepository);
	}
}
