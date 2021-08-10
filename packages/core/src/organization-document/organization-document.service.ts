import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationDocument } from './organization-document.entity';

@Injectable()
export class OrganizationDocumentService extends TenantAwareCrudService<OrganizationDocument> {
	constructor(
		@InjectRepository(OrganizationDocument)
		private readonly organizationDocumentRepository: Repository<OrganizationDocument>
	) {
		super(organizationDocumentRepository);
	}
}
