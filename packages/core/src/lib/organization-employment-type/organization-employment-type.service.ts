import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmOrganizationEmploymentTypeRepository } from './repository/type-orm-organization-employment-type.repository';
import { MikroOrmOrganizationEmploymentTypeRepository } from './repository/mikro-orm-organization-employment-type.repository';

@Injectable()
export class OrganizationEmploymentTypeService extends TenantAwareCrudService<OrganizationEmploymentType> {
	constructor(
		@InjectRepository(OrganizationEmploymentType)
		typeOrmOrganizationEmploymentTypeRepository: TypeOrmOrganizationEmploymentTypeRepository,

		mikroOrmOrganizationEmploymentTypeRepository: MikroOrmOrganizationEmploymentTypeRepository
	) {
		super(typeOrmOrganizationEmploymentTypeRepository, mikroOrmOrganizationEmploymentTypeRepository);
	}
}
