import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './organization.entity';
import { MikroOrmOrganizationRepository } from './repository/mikro-orm-organization.repository';
import { TypeOrmOrganizationRepository } from './repository/type-orm-organization.repository';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		@InjectRepository(Organization)
		typeOrmOrganizationRepository: TypeOrmOrganizationRepository,

		mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {
		super(typeOrmOrganizationRepository, mikroOrmOrganizationRepository);
	}
}
