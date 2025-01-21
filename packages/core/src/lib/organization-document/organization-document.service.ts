import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { TypeOrmOrganizationDocumentRepository } from './repository/type-orm-organization-document.repository';
import { MikroOrmOrganizationDocumentRepository } from './repository/mikro-orm-organization-document.repository';
import { OrganizationDocument } from './organization-document.entity';

@Injectable()
export class OrganizationDocumentService extends TenantAwareCrudService<OrganizationDocument> {
	constructor(
		typeOrmOrganizationDocumentRepository: TypeOrmOrganizationDocumentRepository,
		mikroOrmOrganizationDocumentRepository: MikroOrmOrganizationDocumentRepository
	) {
		super(typeOrmOrganizationDocumentRepository, mikroOrmOrganizationDocumentRepository);
	}
}
