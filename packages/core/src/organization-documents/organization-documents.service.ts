import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationDocuments } from './organization-documents.entity';

@Injectable()
export class OrganizationDocumentsService extends TenantAwareCrudService<OrganizationDocuments> {
	constructor(
		@InjectRepository(OrganizationDocuments)
		private readonly candidateDocumentRepository: Repository<OrganizationDocuments>
	) {
		super(candidateDocumentRepository);
	}
}
