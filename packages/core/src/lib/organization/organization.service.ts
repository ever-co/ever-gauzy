import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './organization.entity';
import { TypeOrmOrganizationRepository, MikroOrmOrganizationRepository } from './repository';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {
		super(typeOrmOrganizationRepository, mikroOrmOrganizationRepository);
	}
}
